import i18next from "i18next";
import { computed, makeObservable, override } from "mobx";
import Resource from "terriajs-cesium/Source/Core/Resource";
import PolylineGraphics from "terriajs-cesium/Source/DataSources/PolylineGraphics";
import PolygonGraphics from "terriajs-cesium/Source/DataSources/PolygonGraphics";
import KmlDataSource from "terriajs-cesium/Source/DataSources/KmlDataSource";
import TerriaError, { networkRequestError } from "../../../Core/TerriaError";
import isDefined from "../../../Core/isDefined";
import readXml from "../../../Core/readXml";
import CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import KmlCatalogItemTraits from "../../../Traits/TraitsClasses/KmlCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import { ModelConstructorParameters } from "../../Definition/Model";
import HasLocalData from "../../HasLocalData";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import CesiumIonMixin from "../../../ModelMixins/CesiumIonMixin";
import Color from "terriajs-cesium/Source/Core/Color";
import Positions from "terriajs-cesium/Source/DataSources/PositionProperty";
import PolylineEntity from "terriajs-cesium/Source/Scene/Polyline";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import Property from "terriajs-cesium/Source/DataSources/Property";

const kmzRegex = /\.kmz$/i;

class KmlCatalogItem
  extends MappableMixin(
    UrlMixin(
      CesiumIonMixin(CatalogMemberMixin(CreateModel(KmlCatalogItemTraits)))
    )
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

  protected async forceLoadMapItems(): Promise<void> {
    try {
      let kmlLoadInput: undefined | string | Resource | Document | Blob =
        undefined;

      if (isDefined(this.kmlString)) {
        const parser = new DOMParser();
        kmlLoadInput = parser.parseFromString(this.kmlString, "text/xml");
      } else if (isDefined(this._kmlFile)) {
        if (this._kmlFile.name && this._kmlFile.name.match(kmzRegex)) {
          kmlLoadInput = this._kmlFile;
        } else {
          kmlLoadInput = await readXml(this._kmlFile);
        }
      } else if (isDefined(this.ionResource)) {
        kmlLoadInput = this.ionResource;
      } else if (isDefined(this.url)) {
        kmlLoadInput = proxyCatalogItemUrl(this, this.url);
      }

      if (!kmlLoadInput) {
        throw networkRequestError({
          sender: this,
          title: i18next.t("models.kml.unableToLoadItemTitle"),
          message: i18next.t("models.kml.unableToLoadItemMessage")
        });
      }
      this._dataSource = await KmlDataSource.load(kmlLoadInput, {
        clampToGround: this.clampToGround,
        sourceUri: this.dataSourceUri
          ? proxyCatalogItemUrl(this, this.dataSourceUri, "1d")
          : undefined
      } as any);

      this.polylineClampToGround(this._dataSource);
    } catch (e) {
      throw networkRequestError(
        TerriaError.from(e, {
          sender: this,
          title: i18next.t("models.kml.errorLoadingTitle"),
          message: i18next.t("models.kml.errorLoadingMessage", {
            appName: this.terria.appName
          })
        })
      );
    }
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
    return this.loadIonResource();
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
  }
}

export default KmlCatalogItem;

function getPropertyValue<T>(property: Property | undefined): T | undefined {
  if (property === undefined) {
    return undefined;
  }
  return property.getValue(JulianDate.now());
}