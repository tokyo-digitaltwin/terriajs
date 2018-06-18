import { configure, runInAction, autorun } from 'mobx';
import primitiveTrait from '../../lib/Traits/primitiveTrait';
import objectTrait from '../../lib/Traits/objectTrait';
import ModelTraits from '../../lib/Traits/ModelTraits';
import Model from '../../lib/Models/Model';
import Terria from '../../lib/Models/TerriaNew';

configure({
    enforceActions: true,
    computedRequiresReaction: true
});

class InnerTraits extends ModelTraits {
    @primitiveTrait({
        type: 'string',
        name: 'Foo',
        description: 'Foo'
    })
    foo?: string;

    @primitiveTrait({
        type: 'number',
        name: 'Bar',
        description: 'Bar'
    })
    bar?: number;

    @primitiveTrait({
        type: 'boolean',
        name: 'Baz',
        description: 'Baz'
    })
    baz?: boolean;
}

class OuterTraits extends ModelTraits {
    @objectTrait({
        type: InnerTraits,
        name: 'Inner',
        description: 'Inner'
    })
    inner?: InnerTraits;
}

interface TestModel extends Model.InterfaceFromDefinition<OuterTraits> {}
@Model.definition(OuterTraits)
class TestModel extends Model<OuterTraits> {

}

describe('objectTrait', function() {
    it('returns undefined if all strata are undefined', function() {
        const terria = new Terria();
        const model = new TestModel('test', terria);
        model.strata.set('definition', new OuterTraits());
        model.strata.set('user', new OuterTraits());
        expect(model.inner).toBeUndefined();
    });

    it('combines values from different strata', function() {
        const terria = new Terria();
        const model = new TestModel('test', terria);

        const definition = new OuterTraits();
        const user = new OuterTraits();
        model.strata.set('definition', definition);
        model.strata.set('user', user);

        definition.inner = new InnerTraits();
        definition.inner.foo = 'a';
        definition.inner.bar = 1;

        user.inner = new InnerTraits();
        user.inner.bar = 2;
        user.inner.baz = true;

        expect(model.inner).toBeDefined();

        if (model.inner !== undefined) {
            expect(model.inner.foo).toEqual('a');
            expect(model.inner.bar).toEqual(2);
            expect(model.inner.baz).toEqual(true);
        }
    });

    it('updates to reflect properties added after evaluation', function() {
        const terria = new Terria();
        const model = new TestModel('test', terria);

        const definition = new OuterTraits();
        const user = new OuterTraits();
        model.strata.set('definition', definition);
        model.strata.set('user', user);

        definition.inner = new InnerTraits();
        definition.inner.foo = 'a';
        definition.inner.bar = 1;

        user.inner = new InnerTraits();

        expect(model.inner).toBeDefined();

        if (model.inner !== undefined) {
            expect(model.inner.foo).toEqual('a');
            expect(model.inner.bar).toEqual(1);
            expect(model.inner.baz).toBeUndefined();

            runInAction(() => {
                expect(user.inner).toBeDefined();
                if (user.inner !== undefined) {
                    user.inner.bar = 2;
                }
            });

            expect(model.inner.bar).toEqual(2);
        }
    });
});
