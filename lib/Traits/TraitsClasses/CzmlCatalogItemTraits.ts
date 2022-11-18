import { JsonObject } from "../../Core/Json";
import anyTrait from "../Decorators/anyTrait";
import primitiveTrait from "../Decorators/primitiveTrait";
import mixTraits from "../mixTraits";
import AutoRefreshingTraits from "./AutoRefreshingTraits";
import CatalogMemberTraits from "./CatalogMemberTraits";
import LegendOwnerTraits from "./LegendOwnerTraits";
import MappableTraits from "./MappableTraits";
import TimeVaryingTraits from "./TimeVaryingTraits";
import UrlTraits from "./UrlTraits";

export default class CzmlCatalogItemTraits extends mixTraits(
  AutoRefreshingTraits,
  TimeVaryingTraits,
  UrlTraits,
  CatalogMemberTraits,
  LegendOwnerTraits,
  MappableTraits
) {
  @anyTrait({
    name: "CZML Data",
    description: "A CZML data array."
  })
  czmlData?: JsonObject[];

  @primitiveTrait({
    type: "string",
    name: "CZML String",
    description: "A CZML string."
  })
  czmlString?: string;

  @primitiveTrait({
    type: "number",
    name: "Cesium classification type",
    description:
      "Whether a Cesium entity's classification affects terrain, 3D Tiles or both. 0 = terrain, 1 = 3d-tiles and 2 = both."
  })
  cesiumClassificationType: number = 0;

}
