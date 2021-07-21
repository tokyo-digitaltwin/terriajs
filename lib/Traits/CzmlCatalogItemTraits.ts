import { JsonObject } from "../Core/Json";
import anyTrait from "./anyTrait";
import AutoRefreshingTraits from "./AutoRefreshingTraits";
import CatalogMemberTraits from "./CatalogMemberTraits";
import DiscretelyTimeVaryingTraits from "./DiscretelyTimeVaryingTraits";
import FeatureInfoTraits from "./FeatureInfoTraits";
import MappableTraits from "./MappableTraits";
import mixTraits from "./mixTraits";
import primitiveTrait from "./primitiveTrait";
import UrlTraits from "./UrlTraits";

export default class CzmlCatalogItemTraits extends mixTraits(
  AutoRefreshingTraits,
  DiscretelyTimeVaryingTraits,
  FeatureInfoTraits,
  UrlTraits,
  CatalogMemberTraits,
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
