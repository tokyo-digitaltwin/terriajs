import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import CzmlDataSource from "terriajs-cesium/Source/DataSources/CzmlDataSource";
import collectPositions from "../../../lib/Models/ItemSearchProviders/collectPositions";

const createEntity = async (packet: unknown) => {
  const ds = await CzmlDataSource.load([
    {
      id: "document",
      version: "1.0",
      clock: {}
    },
    packet
  ]);
  const entity = ds.entities.values[0];
  return entity;
};

describe("collectPositions", () => {
  let time: JulianDate;
  beforeAll(() => {
    time = JulianDate.fromDate(new Date(1970, 0, 1, 0, 0, 0));
  });

  it("handles a point entity", async () => {
    const entity = await createEntity({
      id: "1",
      point: {},
      position: { cartographicDegrees: [139, 35, 0] }
    });
    const positions = collectPositions(entity, time);
    expect(positions.length).toEqual(1);
    expect(positions[0].constructor).toBe(Cartesian3);
  });
  it("handles a polyline entity", async () => {
    const entity = await createEntity({
      id: "1",
      polyline: {
        positions: {
          cartographicDegrees: [139, 35, 0, 140, 36, 0]
        }
      }
    });
    const positions = collectPositions(entity, time);
    expect(positions.length).toEqual(2);
    expect(positions[0].constructor).toBe(Cartesian3);
  });
  it("handles a corridor entity", async () => {
    const entity = await createEntity({
      id: "1",
      corridor: {
        positions: {
          cartographicDegrees: [139, 35, 0, 140, 36, 0]
        }
      }
    });
    const positions = collectPositions(entity, time);
    expect(positions.length).toEqual(2);
    expect(positions[0].constructor).toBe(Cartesian3);
  });
  it("handles a polyline volume entity", async () => {
    const entity = await createEntity({
      id: "1",
      polylineVolume: {
        positions: {
          cartographicDegrees: [139, 35, 0, 140, 36, 0]
        }
      }
    });
    const positions = collectPositions(entity, time);
    expect(positions.length).toEqual(2);
    expect(positions[0].constructor).toBe(Cartesian3);
  });
  it("handles a polygon entity", async () => {
    const entity = await createEntity({
      id: "1",
      polygon: {
        positions: {
          cartographicDegrees: [139, 35, 0, 140, 35, 0, 140, 36, 0, 139, 36, 0]
        }
      }
    });
    const positions = collectPositions(entity, time);
    expect(positions.length).toEqual(4);
    expect(positions[0].constructor).toBe(Cartesian3);
  });
});
