import { reaction } from "mobx";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import Cesium from "../../../Models/Cesium";
import ViewState from "../../../ReactViewModels/ViewState";
import PositionRightOfWorkbench from "../../Workbench/PositionRightOfWorkbench";
import DropPedestrianToGround from "./DropPedestrianToGround";
import MiniMap, { getViewFromScene, MiniMapView } from "./MiniMap";
import MovementControls from "./MovementControls";
import MeasureTool from "../../Map/Navigation/Items/MeasureTool";
import AreaMeasureTool from "../../Map/Navigation/Items/AreaMeasureTool";


// The desired camera height measured from the surface in metres
export const PEDESTRIAN_HEIGHT = 1.7;

// Maximum up/down look angle in degrees
export const MAX_VERTICAL_LOOK_ANGLE = 40;

type PedestrianModeProps = {
  viewState: ViewState;
};
export const PEDESTRIAN_MODE_ID = "pedestrian-mode";

const PedestrianMode: React.FC<PedestrianModeProps> = observer((props) => {
  const { viewState } = props;

  const cesium = viewState.terria.currentViewer;
  const [isDropped, setIsDropped] = useState<boolean>(false);
  const [view, setView] = useState<MiniMapView | undefined>();

  const onDropCancelled = () => viewState.closeTool();
  //if viewer is not cesium close tool.
  if (!(cesium instanceof Cesium)) {
    viewState.closeTool();
    return null;
  }
  const updateView = () => setView(getViewFromScene(cesium.scene));

  useEffect(() => {
    const targetIds = [MeasureTool.id, AreaMeasureTool.id]
    const items = viewState.terria.mapNavigationModel.items.filter(val=>targetIds.includes(val.id))

    if (items && items.length>0) {
      for (let index = 0; index < items.length; index++) {
        let item = items[index];
        if (item && item.controller && item.controller.active) {
          item.controller.deactivate();
        }
      }
    }
    viewState.terria.mapNavigationModel.disable(MeasureTool.id);
    viewState.terria.mapNavigationModel.disable(AreaMeasureTool.id);
    return () => {
      viewState.terria.mapNavigationModel.enable(MeasureTool.id);
      viewState.terria.mapNavigationModel.enable(AreaMeasureTool.id);
    };
  }, []);

  useEffect(function closeOnZoomTo() {
    return reaction(
      () => cesium.isMapZooming,
      (isMapZooming) => {
        if (isMapZooming) viewState.closeTool();
      }
    );
  }, []);

  return (
    <>
      {!isDropped && (
        <DropPedestrianToGround
          cesium={cesium}
          afterDrop={() => setIsDropped(true)}
          onDropCancelled={onDropCancelled}
          pedestrianHeight={PEDESTRIAN_HEIGHT}
        />
      )}
      {isDropped && (
        <>
          <ControlsContainer viewState={viewState}>
            <MovementControls
              cesium={cesium}
              onMove={updateView}
              pedestrianHeight={PEDESTRIAN_HEIGHT}
              maxVerticalLookAngle={MAX_VERTICAL_LOOK_ANGLE}
            />
          </ControlsContainer>
          <MiniMapContainer viewState={viewState}>
            <MiniMap
              terria={viewState.terria}
              baseMap={viewState.terria.mainViewer.baseMap!}
              view={view || getViewFromScene(cesium.scene)}
            />
          </MiniMapContainer>
        </>
      )}
    </>
  );
});

const ControlsContainer = styled(PositionRightOfWorkbench)`
  width: 140px;
  top: unset;
  left: 0;
  bottom: 300px;
`;

const MiniMapContainer = styled(PositionRightOfWorkbench)`
  width: 140px;
  height: 180px;
  top: unset;
  left: 0;
  bottom: 100px;
`;

export default PedestrianMode;
