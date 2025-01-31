import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import isDefined from "../../Core/isDefined";

function collectPositions(entity: Entity, time: JulianDate): Cartesian3[] {
  if (entity.position)
    return [entity.position.getValue(time)].filter(isDefined);
  if (entity.polyline) return entity.polyline.positions?.getValue(time);
  if (entity.corridor) return entity.corridor.positions?.getValue(time);
  if (entity.polylineVolume)
    return entity.polylineVolume.positions?.getValue(time);
  if (entity.polygon) {
    const hierarchy: PolygonHierarchy =
      entity.polygon.hierarchy?.getValue(time);
    return hierarchy.positions;
  }
  return [];
}

export default collectPositions;
