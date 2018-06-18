import ModelTraits from './ModelTraits';
import Trait, { TraitOptions } from './Trait';

interface TraitsConstructor<T> {
    new(): T;
    traits: {
        [id: string]: Trait;
    };
    isRemoval?: (instance: T) => boolean;
}

export interface ObjectArrayTraitOptions<T extends ModelTraits> extends TraitOptions {
    type: TraitsConstructor<T>;
    idProperty: keyof T;
}

export default function objectArrayTrait<T extends ModelTraits>(options: ObjectArrayTraitOptions<T>) {
    return function(target: any, propertyKey: string) {
        const constructor = target.constructor;
        if (!constructor.traits) {
            constructor.traits = {};
        }
        constructor.traits[propertyKey] = new ObjectArrayTrait(propertyKey, options);
    }
}

export class ObjectArrayTrait<T extends ModelTraits> extends Trait {
    readonly type: TraitsConstructor<T>;
    readonly idProperty: keyof T;

    constructor(id: string, options: ObjectArrayTraitOptions<T>) {
        super(id, options);
        this.type = options.type;
        this.idProperty = options.idProperty;
    }

    getValue(strataTopToBottom: Partial<ModelTraits>[]): ReadonlyArray<T> | undefined {
        const objectArrayStrata = strataTopToBottom.map((stratum: any) => stratum[this.id]).filter(stratum => stratum !== undefined);
        if (objectArrayStrata.length === 0) {
            return undefined;
        }

        const result: T[][] = [];
        const idMap: { [id: string ]: T[] } = {};
        const removedIds: { [id: string]: boolean } = {};

        // Find the unique objects and the strata that go into each.
        for (let i = 0; i < objectArrayStrata.length; ++i) {
            const objectArray = objectArrayStrata[i];

            if (objectArray) {
                objectArray.forEach((o: T) => {
                    const id = o[this.idProperty].toString();
                    if (this.type.isRemoval !== undefined && this.type.isRemoval(o)) {
                        // This ID is removed in this stratum.
                        removedIds[id] = true;
                    } else if (removedIds[id]) {
                        // This ID was removed by a stratum above this one, so ignore it.
                        return;
                    } else if (!idMap[id]) {
                        // This is the first time we've seen this ID, so add it
                        const newObjectStrata = [o];
                        idMap[id] = newObjectStrata;
                        result.push(newObjectStrata);
                    } else {
                        idMap[id].push(o);
                    }
                });
            }
        }

        // Flatten each unique object.
        return result.map(strata => {
            const ResultType = this.type;
            const result = new ResultType();
            const resultAny: any = result;

            const traits = ResultType.traits;
            Object.keys(traits).forEach(traitId => {
                resultAny[traitId] = traits[traitId].getValue(strata);
            });

            return result;
        });
    }
}
