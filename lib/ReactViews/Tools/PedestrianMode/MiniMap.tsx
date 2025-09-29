import { action, autorun, computed } from "mobx";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import Terria from "../../../Models/Terria";
import ViewerMode from "../../../Models/ViewerMode";
import TerriaViewer from "../../../ViewModels/TerriaViewer";
import Marker from "./Marker";

const minimapNavIcon = require("../../../../wwwroot/images/minimap-nav.svg");
const CALIBRATION = 86;

type MiniMapProps = {
  terria: Terria;
  baseMap: MappableMixin.Instance;
  view: MiniMapView;
};

export type MiniMapView = {
  // The 2d rectangle view
  rectangle: Rectangle;
  // Minimap marker position
  position: Cartesian3;
  // Minimap marker heading in radians
  rotation: number;
};

const MiniMap: React.FC<MiniMapProps> = (props) => {
  const { terria, baseMap, view } = props;
  const container = useRef<HTMLDivElement>(null);
  const [miniMapViewer, setMiniMapViewer] = useState<
    TerriaViewer | undefined
  >();
  const [locationMarker, setLocationMarker] = useState<Marker | undefined>();

  useEffect(
    action(() => {
      const marker = new Marker(
        terria,
        minimapNavIcon,
        view.position,
        view.rotation
      );
      const viewer = new TerriaViewer(
        terria,
        computed(() => [marker])
      );

      viewer.viewerMode = ViewerMode.Leaflet;
      viewer.disableInteraction = true;
      if (container.current) viewer.attach(container.current);

      viewer.setBaseMap(baseMap);

      setMiniMapViewer(viewer);
      setLocationMarker(marker);

      return () => viewer.destroy();
    }),
    [terria, baseMap]
  );

  useEffect(() => {
    const disposer = autorun(() => {
      if (miniMapViewer) miniMapViewer.currentViewer.zoomTo(view.rectangle, 0);
      if (locationMarker) {
        locationMarker.position = view.position;
        locationMarker.rotation = view.rotation;
      }
    });
    return disposer;
  }, [miniMapViewer, locationMarker, view]);

  return <MapContainer ref={container} />;
};

const MapContainer = styled.div`
  height: 180px;
  box-sizing: border;
  border: 2px solid white;
  border-radius: 4px;
  box-shadow: 0 4px 8px 4px rgb(0 0 0 / 5%);

  & .leaflet-control-attribution {
    display: none;
  }
`;

/**
 * Convert the camera position to a zoomable rectangle and point
 */
export function getViewFromScene(scene: Scene): MiniMapView {
  const camera = scene.camera;
  // This seem to work for now as a zoom rectangle for leaflet. Consider
  // adapting Cesium.getCurrentCameraView() for a more sophisticated
  // implementation.
  const rect = bboxFromCenterMeters(camera.positionCartographic.longitude, camera.positionCartographic.latitude, 500);
  const rectangle = new Rectangle(
    rect.west,
    rect.south, 
    rect.east,
    rect.north
  );
  return {
    rectangle,
    position: camera.position,
    rotation: camera.heading
  };
}

function bboxFromCenterMeters(lon: any, lat: any, meters: any) {
  const R = 6378137; 
  const degPerRad = 180 / Math.PI;

  const dLat = ((meters / CALIBRATION) / R) * degPerRad;
  const dLon = ((meters / CALIBRATION) / (R * Math.cos(lat * Math.PI / 180))) * degPerRad;

  const west  = lon - dLon;
  const south = lat - dLat;
  const east  = lon + dLon;
  const north = lat + dLat;

  const norm = (x: any) => ((x + 180) % 360 + 360) % 360 - 180;

  return { west: norm(west), south: Math.max(-90, south), east: norm(east), north: Math.min(90, north) };
}

export default MiniMap;
