import i18next from "i18next";
import { computed, makeObservable, override } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import Resource from "terriajs-cesium/Source/Core/Resource";
import sampleTerrain from "terriajs-cesium/Source/Core/sampleTerrain";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import PolylineGraphics from "terriajs-cesium/Source/DataSources/PolylineGraphics";
import PolygonGraphics from "terriajs-cesium/Source/DataSources/PolygonGraphics";
import KmlDataSource from "terriajs-cesium/Source/DataSources/KmlDataSource";
import Property from "terriajs-cesium/Source/DataSources/Property";
import isDefined from "../../../Core/isDefined";
import readXml from "../../../Core/readXml";
import TerriaError, { networkRequestError } from "../../../Core/TerriaError";
import CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import KmlCatalogItemTraits from "../../../Traits/TraitsClasses/KmlCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import HasLocalData from "../../HasLocalData";
import { ModelConstructorParameters } from "../../Definition/Model";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import Color from "terriajs-cesium/Source/Core/Color";
import Positions from "terriajs-cesium/Source/DataSources/PositionProperty";
import PolylineEntity from "terriajs-cesium/Source/Scene/Polyline";

const kmzRegex = /\.kmz$/i;

class KmlCatalogItem
  extends MappableMixin(
    UrlMixin(CatalogMemberMixin(CreateModel(KmlCatalogItemTraits)))
  )
  implements HasLocalData
{
  static readonly type = "kml";

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
  }

  get type() {
    return KmlCatalogItem.type;
  }

  private _dataSource: KmlDataSource | undefined;

  private _kmlFile?: File;

  setFileInput(file: File) {
    this._kmlFile = file;
  }

  @computed
  get hasLocalData(): boolean {
    return isDefined(this._kmlFile);
  }

  @override
  get cacheDuration(): string {
    if (isDefined(super.cacheDuration)) {
      return super.cacheDuration;
    }
    return "1d";
  }

  protected forceLoadMapItems(): Promise<void> {
    return new Promise<string | Resource | Document | Blob>((resolve) => {
      if (isDefined(this.kmlString)) {
        const parser = new DOMParser();
        resolve(parser.parseFromString(this.kmlString, "text/xml"));
      } else if (isDefined(this._kmlFile)) {
        if (this._kmlFile.name && this._kmlFile.name.match(kmzRegex)) {
          resolve(this._kmlFile);
        } else {
          resolve(readXml(this._kmlFile));
        }
      } else if (isDefined(this.url)) {
        resolve(proxyCatalogItemUrl(this, this.url));
      } else {
        throw networkRequestError({
          sender: this,
          title: i18next.t("models.kml.unableToLoadItemTitle"),
          message: i18next.t("models.kml.unableToLoadItemMessage")
        });
      }
    })
      .then((kmlLoadInput) => {
        return KmlDataSource.load(kmlLoadInput, { clampToGround: this.clampToGround });
      })
      .then((dataSource) => {
        this._dataSource = dataSource;
        this.polylineClampToGround(dataSource); // To make work the polylines
      })
      .catch((e) => {
        throw networkRequestError(
          TerriaError.from(e, {
            sender: this,
            title: i18next.t("models.kml.errorLoadingTitle"),
            message: i18next.t("models.kml.errorLoadingMessage", {
              appName: this.terria.appName
            })
          })
        );
      });
  }

  @computed
  get mapItems() {
    if (this.isLoadingMapItems || this._dataSource === undefined) {
      return [];
    }
    this._dataSource.show = this.show;
    return [this._dataSource];
  }
  protected forceLoadMetadata(): Promise<void> {
    return Promise.resolve();
  }

  private polylineClampToGround(kmlDataSource: KmlDataSource) {
    // Clamp features to terrain.
    if (isDefined(this.terria.cesium)) {
      const entities = kmlDataSource.entities.values;
      for (let i = 0; i < entities.length; ++i) {
        try {
          const polygon = entities[i].polygon;
          if (!isDefined(polygon)) {
            if(isDefined(PolylineGraphics)) {
              const polylineEntity = entities[i].polyline;
              let polylineFinal = kmlDataSource.entities.add({
                polyline: {
                  positions: getPropertyValue<Positions>(polylineEntity!.positions),
                  clampToGround: this.clampToGround,
                  width: polylineEntity!.width,
                  material: polylineEntity!.material
                },
                description: entities[i].description
              });
              kmlDataSource.entities.remove(entities[i]);
            }    
          }
        } 
        catch{}
    
  }

}
}}

export default KmlCatalogItem;

function getPropertyValue<T>(property: Property | undefined): T | undefined {
  if (property === undefined) {
    return undefined;
  }
  return property.getValue(JulianDate.now());
}
