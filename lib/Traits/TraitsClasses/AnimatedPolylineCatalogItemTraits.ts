import ModelTraits from "../ModelTraits";
import MappableTraits from "./MappableTraits";
import mixTraits from "../mixTraits";
import CatalogMemberTraits from "./CatalogMemberTraits";
import UrlTraits from "./UrlTraits";
import primitiveTrait from "../Decorators/primitiveTrait";
import objectArrayTrait from "../Decorators/objectArrayTrait";
import anyTrait from "../Decorators/anyTrait";
import LegendOwnerTraits from "./LegendOwnerTraits";

export class WaypointTraits extends ModelTraits {
  @primitiveTrait({
    type: "number",
    name: "Longitude",
    description: "Longitude"
  })
  longitude?: number;
  @primitiveTrait({
    type: "number",
    name: "Latitude",
    description: "Latitude"
  })
  latitude?: number;
  @primitiveTrait({
    type: "number",
    name: "Height",
    description: "Height"
  })
  height?: number;
}

export class TrajectoryTraits extends ModelTraits {
  @objectArrayTrait({
    type: WaypointTraits,
    name: "Waypoints",
    description: "Waypoints that constitute this trajectory.",
    idProperty: "index"
  })
  waypoints?: WaypointTraits[];

  @anyTrait({
    name: "Attributes",
    description: "Per instance attributes."
  })
  attributes?: { [name: string]: number[] };

  @primitiveTrait({
    type: "number",
    name: "Width",
    description: "Line width"
  })
  width?: number;
}

export default class AnimatedPolylineCatalogItemTraits extends mixTraits(
  // FeatureInfoTraits,
  LegendOwnerTraits,
  UrlTraits,
  MappableTraits,
  CatalogMemberTraits
) {
  @primitiveTrait({
    type: "number",
    name: "Interval",
    description: "Interval at which moving patterns are repeated."
  })
  interval?: number;

  @primitiveTrait({
    type: "number",
    name: "Frames per loop",
    description: "Animation speed in terms of the number of frames."
  })
  framesPerLoop?: number;

  @primitiveTrait({
    type: "string",
    name: "Color expression",
    description: "Expression used to shade the polylines."
  })
  colorExpression?: string;

  @objectArrayTrait({
    type: TrajectoryTraits,
    name: "Trajectories",
    description: "Trajectories",
    idProperty: "index"
  })
  trajectories?: TrajectoryTraits[];
}
