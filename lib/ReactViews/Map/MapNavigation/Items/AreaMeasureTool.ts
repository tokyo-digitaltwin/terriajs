"use strict";
import i18next from "i18next";
import React from "react";
import turfArea from '@turf/area'
import { polygon as turfPolygon } from '@turf/helpers'
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
import Polygon, {PositionsArray } from '../../../../Map/Cesium/Polygon'
import UserDrawing from "../../../../Models/UserDrawing";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";

interface AreaMeasureToolOptions {
  terria: Terria;
  onClose(): void;
  handleClick(): void;
}

export default class AreaMeasureTool extends MapNavigationItemController {
  static id = "area-measure-tool";
  static displayName = "AreaMeasureTool";

  private readonly terria: Terria;
  private totalDistanceMetres: number = 0;
  private totalAreaMetresSquared: number = 0;
  private userDrawing: UserDrawing;

  onClose: () => void;
  handleClick: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: AreaMeasureToolOptions) {
    super();
    this.terria = props.terria;
    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.areaMeasureTool"),
      allowPolygon: true,
      onPointClicked: this.onPointClicked.bind(this),
      onPointMoved: this.onPointMoved.bind(this),
      onCleanUp: this.onCleanUp.bind(this),
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this)
    });
    this.onClose = props.onClose;
    this.handleClick = props.handleClick;
  }

  get glyph(): any {
    return GLYPHS.measureArea;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  prettifyNumber(number: number, squared: boolean) {
    if (number <= 0) {
      return "";
    }
    // Given a number representing a number in metres, make it human readable
    let label = "m";
    if (squared) {
      if (number > 999999) {
        label = "km";
        number = number / 1000000.0;
      }
    } else {
      if (number > 999) {
        label = "km";
        number = number / 1000.0;
      }
    }
    let numberStr = number.toFixed(2);
    // http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
    numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    numberStr = `${numberStr} ${label}`;
    if (squared) {
      numberStr += "\u00B2";
    }
    return numberStr;
  }

  updateDistance(pointEntities: CustomDataSource) {
    this.totalDistanceMetres = 0;
    if (pointEntities.entities.values.length < 1) {
      return;
    }

    const prevPoint = pointEntities.entities.values[0];
    let prevPointPos = prevPoint.position!.getValue(
      this.terria.timelineClock.currentTime
    );
    for (let i = 1; i < pointEntities.entities.values.length; i++) {
      const currentPoint = pointEntities.entities.values[i];
      const currentPointPos = currentPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );

      this.totalDistanceMetres =
        this.totalDistanceMetres +
        this.getGeodesicDistance(prevPointPos!, currentPointPos!);

      prevPointPos = currentPointPos;
    }
    if (this.userDrawing.closeLoop) {
      const firstPoint = pointEntities.entities.values[0];
      const firstPointPos = firstPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );
      this.totalDistanceMetres =
        this.totalDistanceMetres +
        this.getGeodesicDistance(prevPointPos!, firstPointPos!);
    }
  }

  updateArea(pointEntities: CustomDataSource) {
    this.totalAreaMetresSquared = 0;
    if (!this.userDrawing.closeLoop) {
      // Not a closed polygon? Don't calculate area.
      return;
    }
    if (pointEntities.entities.values.length < 3) {
      return;
    }
    const perPositionHeight = true;


    const positions:PositionsArray = [];
    for (let i = 0; i < pointEntities.entities.values.length; i++) {
      const currentPoint = pointEntities.entities.values[i];
      const currentPointPos = currentPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );
      positions.push(currentPointPos!);
    }
    const polygon = new Polygon();
    if(!polygon.validatePolygon(positions)){
      this.userDrawing.errorText="<span style='font-weight:bold;color:red;'>"+i18next.t("measure.areaMeasureInvalidError")+"</span>";
      return
    }

    // Request the triangles that make up the polygon from Cesium.
    const tangentPlane = EllipsoidTangentPlane.fromPoints(
      positions,
      Ellipsoid.WGS84
    );
    const keepDuplicates = true;
    const polygons = PolygonGeometryLibrary.polygonsFromHierarchy(
      new PolygonHierarchy(positions),
      keepDuplicates,
      tangentPlane.projectPointsOntoPlane.bind(tangentPlane),
      !perPositionHeight,
      Ellipsoid.WGS84
    );

    const textureCoordinates = undefined;
    const geom = PolygonGeometryLibrary.createGeometryFromPositions(
      Ellipsoid.WGS84,
      polygons.polygons[0],
      textureCoordinates,
      CesiumMath.RADIANS_PER_DEGREE,
      perPositionHeight,
      VertexFormat.POSITION_ONLY
    );
    if (
      geom.indices.length % 3 !== 0 ||
      geom.attributes.position.values.length % 3 !== 0
    ) {
      // Something has gone wrong. We expect triangles. Can't calcuate area.
      return;
    }

    const coords = [];
    for (let i = 0; i < positions.length; i++) {
      const pointsCartographic = Ellipsoid.WGS84.cartesianToCartographic(positions[i]);
      var lon = CesiumMath.toDegrees(pointsCartographic.longitude);
      var lat = CesiumMath.toDegrees(pointsCartographic.latitude);
      coords.push([lon,lat]);
    }
    coords.push(coords[0]);
    let areas = turfArea(turfPolygon([coords]))
    this.totalAreaMetresSquared = areas;
  }

  getGeodesicDistance(pointOne: Cartesian3, pointTwo: Cartesian3) {
    // Note that Cartesian.distance gives the straight line distance between the two points, ignoring
    // curvature. This is not what we want.
    const pickedPointCartographic =
      Ellipsoid.WGS84.cartesianToCartographic(pointOne);
    const lastPointCartographic =
      Ellipsoid.WGS84.cartesianToCartographic(pointTwo);
    const geodesic = new EllipsoidGeodesic(
      pickedPointCartographic,
      lastPointCartographic
    );
    return geodesic.surfaceDistance;
  }

  onCleanUp() {
    this.totalDistanceMetres = 0;
    this.totalAreaMetresSquared = 0;
    super.deactivate();
  }

  onPointClicked(pointEntities: CustomDataSource) {
    this.updateDistance(pointEntities);
    this.updateArea(pointEntities);
  }

  onPointMoved(pointEntities: CustomDataSource) {
    // This is no different to clicking a point.
    this.onPointClicked(pointEntities);
  }

  onMakeDialogMessage = () => {
    const distance = this.prettifyNumber(this.totalDistanceMetres, false);
    let message = "";
    if (this.totalAreaMetresSquared !== 0) {
      if (distance !== '') {
        message +=  "<br>" + i18next.t("measure.areaMeasureLineLabel") + distance;
      }
      message +=
        "<br>" + i18next.t("measure.areaMeasureAreaLabel") + this.prettifyNumber(this.totalAreaMetresSquared, true)+"<br>";
    }
    message += "<span style='font-size:8px;color:blue;'>"+i18next.t("measure.areaMeasureHelp")+"</span>";
    return message;
  };

  /**
   * @overrides
   */
  deactivate() {
    this.userDrawing.endDrawing();
    super.deactivate();
  }

  /**
   * @overrides
   */
  activate() {
    this.userDrawing.enterDrawMode();
    super.activate();
  }
}
