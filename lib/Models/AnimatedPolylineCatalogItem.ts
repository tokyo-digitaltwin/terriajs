import i18next from "i18next";
import {
  computed,
  autorun,
  IReactionDisposer,
  onBecomeObserved,
  onBecomeUnobserved
} from "mobx";
import {
  Primitive,
  GeometryInstance,
  PolylineGeometry,
  Cartesian3,
  PolylineMaterialAppearance,
  Cesium3DTileset,
  GeometryAttribute,
  ComponentDatatype,
  GeometryInstanceAttribute
} from "terriajs-cesium";
// PolylineCommon.js does exist.
// @ts-ignore
import PolylineCommon from "terriajs-cesium/Source/Shaders/PolylineCommon";
import MappableMixin from "../ModelMixins/MappableMixin";
import CatalogMemberMixin from "../ModelMixins/CatalogMemberMixin";
import AnimatedPolylineCatalogItemTraits, {
  WaypointTraits
} from "../Traits/AnimatedPolylineCatalogItemTraits";
import CreateModel from "./CreateModel";
import flatten from "../Core/flatten";
import Terria from "./Terria";
import { BaseModel } from "./Model";
import isDefined from "../Core/isDefined";
import UrlMixin from "../ModelMixins/UrlMixin";
import CommonStrata from "./CommonStrata";
import proxyCatalogItemUrl from "./proxyCatalogItemUrl";
import TerriaError from "../Core/TerriaError";
import loadJson5 from "../Core/loadJson5";

const PER_INSTANCE_VARIABLE_PREFIX = "v_perInstance_";

/**
 * Converts JavaScript numbers into a format that WebGL can understand.
 * @param n The number to format.
 */
const toGlslFloatLiteral = (n: number) => {
  const str = n.toString();
  return str.includes(".") ? str : `${str}.0`;
};

/**
 * Prepares per-vertex attributes for consumption in shaders.
 * @example
 * preparePerVertexAttributes([0, 1, 2])
 * // --> [0, 0, 1, 1, 1, 1, 2, 2]
 */
const preparePerVertexAttributes = (values: readonly number[]) =>
  values.reduce<number[]>((acc, cur, i, { length }) => {
    const first = i === 0;
    const last = i + 1 === length;
    if (first || last) acc.push(cur, cur);
    else acc.push(cur, cur, cur, cur);
    return acc;
  }, []);

/**
 * Wraps the given attributes with GeometryInstanceAttribute instances.
 * @param attributes
 */
const buildGeometryInstanceAttributes = (attributes: {
  [name: string]: readonly number[];
}): { [name: string]: GeometryInstanceAttribute } => {
  return Object.entries(attributes).reduce<{
    [name: string]: GeometryInstanceAttribute;
  }>((acc, [k, value]) => {
    acc[k] = new GeometryInstanceAttribute({
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: value.length,
      normalize: false,
      value: [...value]
    });
    return acc;
  }, {});
};

class AnimatedPolylineCatalogItem extends MappableMixin(
  UrlMixin(CatalogMemberMixin(CreateModel(AnimatedPolylineCatalogItemTraits)))
) {
  static readonly type = "animated-polyline";

  static readonly hasLocalData = false;

  private tween: any = undefined;
  private renderLoopDisposer?: IReactionDisposer = undefined;

  constructor(
    id: string | undefined,
    terria: Terria,
    sourceReference: BaseModel | undefined
  ) {
    super(id, terria, sourceReference);

    // By default, terria pauses cesium's render loop when it observes
    // no user interactions/data changes in a short time period.
    // Forcibly suppress this behavior in order for the animation not to stop.
    onBecomeObserved(
      this,
      "mapItems",
      this.startPreventingRenderPause.bind(this)
    );
    onBecomeUnobserved(
      this,
      "mapItems",
      this.stopPreventingRenderPause.bind(this)
    );
  }

  get type() {
    return AnimatedPolylineCatalogItem.type;
  }

  private startPreventingRenderPause() {
    if (this.renderLoopDisposer) return;
    this.renderLoopDisposer = autorun(() => {
      const { cesium } = this.terria;
      if (!cesium) return;
      // Trick terria into thinking there's an ongoing animation
      // so that rendering does not get paused.
      // This hack depends on CesiumRenderLoopPauser's behavior.
      this.tween = cesium.scene.tweens.add({
        duration: 5,
        startObject: {
          value: 0
        },
        stopObject: {
          value: 0
        },
        _repeat: Infinity
      });
    });
  }
  private stopPreventingRenderPause() {
    // Do clean up.
    if (this.renderLoopDisposer) {
      this.renderLoopDisposer();
      this.renderLoopDisposer = undefined;
    }
    if (this.tween) {
      if (this.terria.cesium) {
        const tweens = this.terria.cesium.scene.tweens;
        // Property 'remove' does exist on type 'TweenCollection'.
        (<any>tweens).remove(this.tween);
      }
      this.tween = undefined;
    }
  }

  protected async forceLoadMapItems(): Promise<void> {
    if (this.trajectories != null && this.trajectories.length) {
      // Wait for nothing if the trajectories have already been loaded.
      return;
    }
    if (this.url) {
      let trajectories: any;
      try {
        trajectories = await loadJson5(proxyCatalogItemUrl(this, this.url));
      } catch (e) {
        throw TerriaError.from(e, {
          title: i18next.t("models.animatedPolyline.errorLoadingTitle"),
          message: i18next.t("models.animatedPolyline.errorLoadingMessage")
        });
      }
      this.setTrait(CommonStrata.definition, "trajectories", trajectories);
      return;
    }
    throw TerriaError.from(
      `Either url or trajectories must be specified in ${this.type}. Found neither.`
    );
  }

  /**
   * Returns a time table for controlling the velocity of motion of the given trajectory.
   */
  private computeTimetable(waypoints: readonly WaypointTraits[]) {
    // Cumulative distances from the beginning of this trajectory. In degrees.
    const cumulativeDistances = waypoints
      .map(({ longitude, latitude }, i, arr) => {
        if (!arr[i + 1]) return undefined;
        const { longitude: nextLongitude, latitude: nextLatitude } = arr[i + 1];
        if (
          longitude == null ||
          latitude == null ||
          nextLongitude == null ||
          nextLatitude == null
        )
          return 0;
        const distance = Math.sqrt(
          (longitude - nextLongitude) ** 2 + (latitude - nextLatitude) ** 2
        );
        return distance;
      })
      .filter(isDefined)
      .reduce<number[]>(
        (acc, cur) => {
          acc.push(acc[acc.length - 1] + cur);
          return acc;
        },
        [0]
      );
    const scaleFactor = 1 / cumulativeDistances[cumulativeDistances.length - 1];

    // Scale cumulative distances so that the value of the end point becomes 1.0.
    const normalizedCumulativeDistances = cumulativeDistances.map(
      c => c * scaleFactor
    );

    return normalizedCumulativeDistances;
  }

  private getGeometryInstances(): GeometryInstance[] {
    return this.trajectories
      .map(({ waypoints, attributes, width }) => {
        const positions = flatten(
          waypoints
            .map(({ longitude, latitude, height }) => [
              longitude,
              latitude,
              height ?? 0
            ])
            .filter(
              (coords): coords is [number, number] =>
                coords[0] != null && coords[1] != null
            )
        );
        const timetable = this.computeTimetable(waypoints);
        const geometry = PolylineGeometry.createGeometry(
          new PolylineGeometry({
            positions: Cartesian3.fromDegreesArrayHeights(positions),
            width: width ?? 1.0,
            vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT
          })
        );
        if (!geometry) return undefined;
        (<any>geometry.attributes).timeTable = new GeometryAttribute({
          componentDatatype: ComponentDatatype.FLOAT,
          componentsPerAttribute: 1,
          values: new Float32Array(preparePerVertexAttributes(timetable))
        });
        return new GeometryInstance({
          geometry,
          attributes: buildGeometryInstanceAttributes(attributes)
        });
      })
      .filter(isDefined);
  }

  /**
   * Turns the user-supplied color expression into a shader expression.
   */
  private getColorExpression() {
    const { colorExpression = "vec4(1.0, 1.0, 1.0, 1.0) * t" } = this;
    const colorExpressionShader = colorExpression.replace(
      /\$(\w+)/g,
      `${PER_INSTANCE_VARIABLE_PREFIX}$1`
    );
    return colorExpressionShader;
  }

  private getVariableAssignments() {
    const attributes = this.getSampleAttributes();
    return Object.keys(attributes)
      .map(
        k =>
          `${PER_INSTANCE_VARIABLE_PREFIX}${k} = czm_batchTable_${k}(batchId);`
      )
      .join("\n");
  }

  private getVariableDeclarations() {
    const attributes = this.getSampleAttributes();
    return Object.entries(attributes)
      .map(([k, v]) => {
        const type = v.length === 1 ? "float" : `vec${v.length}`;
        return `varying ${type} ${PER_INSTANCE_VARIABLE_PREFIX}${k};`;
      })
      .join("\n");
  }

  private getSampleAttributes(): { [k: string]: readonly number[] } {
    return this.trajectories.length ? this.trajectories[0].attributes : {};
  }

  private getVertexShader() {
    const variableDeclarations = this.getVariableDeclarations();
    const variableAssignments = this.getVariableAssignments();
    // Modified version of the default vertex shader of PolylineMaterialAppearance
    return `
    ${PolylineCommon}
    attribute vec3 position3DHigh;
    attribute vec3 position3DLow;
    attribute vec3 prevPosition3DHigh;
    attribute vec3 prevPosition3DLow;
    attribute vec3 nextPosition3DHigh;
    attribute vec3 nextPosition3DLow;
    attribute vec2 expandAndWidth;
    attribute vec2 st;
    attribute float batchId;
    attribute float timeTable;
    attribute vec4 startColor;
    attribute vec4 color;

    varying float v_width;
    varying float v_polylineAngle;
    varying float v_passageTime;
    ${variableDeclarations}

    void main()
    {
        float expandDir = expandAndWidth.x;
        float width = abs(expandAndWidth.y) + 0.5;
        bool usePrev = expandAndWidth.y < 0.0;

        vec4 p = czm_computePosition();
        vec4 prev = czm_computePrevPosition();
        vec4 next = czm_computeNextPosition();

        float angle;
        vec4 positionWC = getPolylineWindowCoordinates(p, prev, next, expandDir, width, usePrev, angle);
        gl_Position = czm_viewportOrthographic * positionWC;

        v_width = width;
        v_polylineAngle = angle;
        v_passageTime = timeTable;
        ${variableAssignments}
    }
    `;
  }

  private getFragmentShader() {
    const variableDeclarations = this.getVariableDeclarations();
    const colorExpression = this.getColorExpression();
    const interval = toGlslFloatLiteral(this.interval ?? 1);
    const framesPerLoop = toGlslFloatLiteral(this.framesPerLoop ?? 300);

    return `
    varying float v_passageTime;
    const float INTERVAL = ${interval};
    const float FRAMES_PER_LOOP = ${framesPerLoop};
    ${variableDeclarations}

    float getTimeSinceLastPassage()
    {
      for (float offset = 1.0; offset > -1.0; offset -= INTERVAL) {
        float now = offset + mod(czm_frameNumber, FRAMES_PER_LOOP) / FRAMES_PER_LOOP; // 0..1
        if (now < v_passageTime) {
          continue;
        }
        float timeSincePassage = now - v_passageTime;
        if (INTERVAL < timeSincePassage) {
          continue;
        }
        return timeSincePassage / INTERVAL;
      }
      return 0.0;
    }
    vec4 getColor(float t) {
      return ${colorExpression};
    }
    void main()
    {
      gl_FragColor = getColor(getTimeSinceLastPassage());
    }
    `;
  }

  private getPrimitive() {
    const geometryInstances = this.getGeometryInstances();
    const vertexShaderSource = this.getVertexShader();
    const fragmentShaderSource = this.getFragmentShader();
    return new Primitive({
      geometryInstances,
      appearance: new PolylineMaterialAppearance({
        translucent: false,
        renderState: {
          depthTest: {
            enabled: true
          }
        },
        vertexShaderSource,
        fragmentShaderSource
      })
    });
  }

  @computed
  get mapItems() {
    const cesium3dtilesLikePrimitive = Object.assign(this.getPrimitive(), {
      allTilesLoaded: undefined
      // ^ Trick terria.js into thinking this is a 3D tiles dataset.
      // This depends on the behaviour of isCesium3DTileset() defined at MappableMixin.ts.
      //
      // Primitive and Cesium3DTileset are both implementations of cesium's
      // Primitive interface and can be used almost interchangeably.
    });
    return [(cesium3dtilesLikePrimitive as unknown) as Cesium3DTileset];
  }

  protected forceLoadMetadata(): Promise<void> {
    return Promise.resolve();
  }
}

export default AnimatedPolylineCatalogItem;
