import { computed, observable, runInAction } from 'mobx';
import * as TerriaError from '../Core/TerriaError';
import isReadOnlyArray from '../Core/isReadOnlyArray';
import CatalogMemberMixin from '../ModelMixins/CatalogMemberMixin';
import GetCapabilitiesMixin from '../ModelMixins/GetCapabilitiesMixin';
import GroupMixin from '../ModelMixins/GroupMixin';
import UrlMixin from '../ModelMixins/UrlMixin';
import ModelReference from '../Traits/ModelReference';
import WebMapServiceCatalogGroupTraits from '../Traits/WebMapServiceCatalogGroupTraits';
import CommonStrata from './CommonStrata';
import Model from './Model';
import Terria from './TerriaNew';
import WebMapServiceCapabilities, { CapabilitiesLayer } from './WebMapServiceCapabilities';
import WebMapServiceCatalogItem from './WebMapServiceCatalogItem3';
import defineLoadableStratum from './defineLoadableStratum';
import * as proxyCatalogItemUrl from './proxyCatalogItemUrl';

class GetCapabilitiesValue {
    constructor(readonly catalogGroup: WebMapServiceCatalogGroup) {
    }

    @observable
    capabilities?: WebMapServiceCapabilities;

    @computed
    get members(): ModelReference[] {
        if (!this.capabilities) {
            return [];
        }

        const layers = this.catalogGroup.flatten ? this.capabilities.allLayers : this.getTopLevelLayers(this.capabilities.rootLayers);

        const id = this.catalogGroup.id;

        // Create a model for each Layer at this level.
        const result: ModelReference[] = [];
        layers.forEach(layer => {
            if (!layer.Name) {
                return;
            }

            const layerId = id + '/' + encodeURIComponent(layer.Name);
            let model = this.catalogGroup.terria.getModelById(WebMapServiceCatalogItem, layerId);
            if (!model) {
                model = new WebMapServiceCatalogItem(layerId, this.catalogGroup.terria);
                const stratum = model.addStratum(CommonStrata.inheritedFromParentGroup);
                this.catalogGroup.terria.addModel(model);
            }

            // TODO: Should this be a "parentStratum" or "inheritedStratum" or something instead?
            const stratum = model.addStratum(CommonStrata.inheritedFromParentGroup);
            stratum.url = this.catalogGroup.url;
            stratum.getCapabilitiesUrl = this.catalogGroup.getCapabilitiesUrl;
            stratum.getCapabilitiesCacheDuration = this.catalogGroup.getCapabilitiesCacheDuration;
            stratum.layers = layer.Name;

            result.push(layerId);
        });

        return result;
    }

    private getTopLevelLayers(rootLayers: CapabilitiesLayer[]): ReadonlyArray<CapabilitiesLayer> {
        if (rootLayers.length === 1) {
            const subLayers = rootLayers[0].Layer;
            if (subLayers === undefined) {
                return [];
            }
            return isReadOnlyArray(subLayers) ? subLayers : [subLayers];
        } else {
            return rootLayers;
        }
    }
}

const GetCapabilitiesStratum = defineLoadableStratum(WebMapServiceCatalogGroupTraits, GetCapabilitiesValue, 'members');

interface ModelWithDefinition extends Model.InterfaceFromDefinition<WebMapServiceCatalogGroupTraits> {}
class ModelWithDefinition extends Model<WebMapServiceCatalogGroupTraits> {}

@Model.definition(WebMapServiceCatalogGroupTraits)
export default class WebMapServiceCatalogGroup extends GetCapabilitiesMixin(GroupMixin(CatalogMemberMixin(UrlMixin(ModelWithDefinition)))) {
    get type() {
        return 'wms-group';
    }

    constructor(id: string, terria: Terria) {
        super(id, terria);
        this.strata.set(GetCapabilitiesMixin.getCapabilitiesStratumName, new GetCapabilitiesStratum(this, layer => this._loadGetCapabilitiesStratum(layer)));
    }

    protected get defaultGetCapabilitiesUrl(): string | undefined {
        if (this.uri) {
            return this.uri.clone().setSearch({
                service: 'WMS',
                version: '1.3.0',
                request: 'GetCapabilities'
            }).toString();
        } else {
            return undefined;
        }
    }

    private _loadGetCapabilitiesStratum(values: typeof GetCapabilitiesStratum.TLoadValue): Promise<void> {
        if (this.getCapabilitiesUrl === undefined) {
            return Promise.reject(new TerriaError({
                title: 'Unable to load GetCapabilities',
                message: 'Could not load the Web Map Service (WMS) GetCapabilities document because the catalog item does not have a `url`.'
            }));
        }

        const proxiedUrl = proxyCatalogItemUrl(this, this.getCapabilitiesUrl, this.getCapabilitiesCacheDuration);
        return WebMapServiceCapabilities.fromUrl(proxiedUrl).then(capabilities => {
            runInAction(() => {
                values.capabilities = capabilities;
            });
        });
    }
}
