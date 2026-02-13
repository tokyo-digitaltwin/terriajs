import i18next from "i18next";
import { RefObject, createRef } from "react";
import ArcType from "terriajs-cesium/Source/Core/ArcType";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import EllipsoidTangentPlane from "terriajs-cesium/Source/Core/EllipsoidTangentPlane";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import PolygonGeometryLibrary from "terriajs-cesium/Source/Core/PolygonGeometryLibrary";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import VertexFormat from "terriajs-cesium/Source/Core/VertexFormat";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Terria from "../../../../Models/Terria";
import UserDrawing from "../../../../Models/UserDrawing";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import PrimitiveCollection from "terriajs-cesium/Source/Scene/PrimitiveCollection";
import LabelCollection from "terriajs-cesium/Source/Scene/LabelCollection";
import PointPrimitiveCollection from "terriajs-cesium/Source/Scene/PointPrimitiveCollection";

import ScreenSpaceEventHandler from "terriajs-cesium/Source/Core/ScreenSpaceEventHandler";
import Color from "terriajs-cesium/Source/Core/Color";
import ScreenSpaceEventType from "terriajs-cesium/Source/Core/ScreenSpaceEventType";
import { getIonMeasurementsModule } from "./SdkAvailability";


interface MeasureToolOptions {
  terria: Terria;
  onClose(): void;
  handleClick(): void;
}

export class SdkHeightMeasureTool extends MapNavigationItemController {
  static id = "heightsdk";
  static displayName = i18next.t("sdkHeight.sdkHeightPluginName");

  private readonly terria: Terria;
  private measure: any;
  private closeBtn: any = null;
  private heightText: any = null;
  private eventHandler: any;
  onClose: () => void;
  handleClick: () => void;

  itemRef: RefObject<HTMLDivElement> = createRef();

  constructor(props: MeasureToolOptions) {
    super();
    this.terria = props.terria;
    this.onClose = props.onClose;
    this.handleClick = props.handleClick;
  }

  get glyph(): any {
    return GLYPHS.sdkHeight;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  async measureHeight(
      message: string,
      labelMessage: string
    ) {

      document.getElementById("center-note")?.remove();

      const note = document.createElement("div");
      note.id = "center-note";
      note.setAttribute("aria-hidden", "true");
      note.style.cssText = `
        position: fixed;
        top: 10%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 100000;
        background: #ffffffff;
        color: #000000ff;
        padding: 12px 12px;
        border-radius: 1px;
        text-align: left;
        font-size: 16px;
        font-family: Inter, sans-serif;
        font-weight: 900;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        max-width: 400px;
        pointer-events: auto;
        display: flex;
        flex-direction: column; 
        align-items: left;
        gap: 10px; 
      `;
      note.textContent = message;

      this.heightText = document.createElement("label");
      this.heightText.style.cssText = `
        font-size: .9375rem;
        font-family: Inter, sans-serif;
        font-weight: 400;
      `;
      this.heightText.textContent = labelMessage;

      const normalBg = "#09315D";
      const hoverBg = "#3A587A";

      this.closeBtn = document.createElement("button");
          this.closeBtn.textContent = i18next.t("sdkHeight.sdkHeightPluginCancel");
          this.closeBtn.style.cssText = `
            border: none;
            background: ${normalBg};
            color: white;
            padding: 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: .9375rem;
            font-weight: 400;
            border-radius: 0px;
            box-shadow: none;
            height: 42px;
          `;

      this.closeBtn.addEventListener("mouseenter", () => {
        this.closeBtn.style.background = hoverBg;
      });

      this.closeBtn.addEventListener("mouseleave", () => {
        this.closeBtn.style.background = normalBg;
      });

      document.body.appendChild(note);
      note.appendChild(this.heightText);
      note.appendChild(this.closeBtn);

      const ion = await getIonMeasurementsModule();
      if (!ion) return;
      const { HeightMeasurement, MeasureUnits, DistanceUnits } = ion;
      
      const scene =
        (this.terria?.currentViewer as any)?.scene ||
        (this.terria as any)?.viewer?.cesiumWidget?.scene;


      if (!scene) return;
      this.eventHandler = new ScreenSpaceEventHandler(scene.canvas);

      const primitives =
      (scene.__heightPrimColl ||= scene.primitives.add(new PrimitiveCollection()));
    const labels =
      (scene.__heightLabelColl ||= scene.primitives.add(new LabelCollection()));
    const points =
      (scene.__heightPointColl ||= scene.primitives.add(new PointPrimitiveCollection()));

      const units = new MeasureUnits({ distanceUnits: DistanceUnits.METERS });

    this.measure = new HeightMeasurement({
      scene,
      units,
      primitives,
      labels,
      points
    });

    this.eventHandler.setInputAction((movement: any) => {
      
        this.measure.handleClick(movement.position);
        const value = (this.measure as any).distance; 
        this.closeBtn.textContent = i18next.t("sdkHeight.sdkHeightPluginDone");
        this.heightText.style.display = true;
        this.heightText.textContent = i18next.t("sdkHeight.sdkHeightPluginHeight") + value.toFixed(2) + " m";

        points._pointPrimitives.forEach((point: any) => {
          point.color = Color.WHITE;
          point.outlineColor = Color.DEEPSKYBLUE;
          point.outlineWidth = 2;
        });

        primitives._primitives.forEach((line: any) => {
          line.color = Color.WHITE;
          line.depthFailColor = Color.WHITE;
        });

    }, ScreenSpaceEventType.LEFT_CLICK);
    

      this.closeBtn?.addEventListener("click", () => {
          if (this.eventHandler) this.eventHandler.destroy(); 
          document.getElementById("center-note")?.remove();
          primitives.removeAll();
          labels.removeAll();
          points.removeAll();
          super.deactivate();
          return null;
      });

  }

  /**
   * @overrides
   */
  deactivate() {
    super.deactivate();
    document.getElementById("center-note")?.remove();
    this.eventHandler?.destroy(); 
    this.measure?.destroy();
    
  }

  /**
   * @overrides
   */
  activate() {
    super.activate();
    this.measureHeight(i18next.t("sdkHeight.sdkHeightPluginNoteTitle"), i18next.t("sdkHeight.sdkHeightPluginNoteMessage"));
    
  }
}
