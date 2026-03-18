export type IonMeasurementsModule = {
  HeightMeasurement: any;
  MeasureUnits: any;
  MeasurementMouseHandler: any;
  DistanceUnits: any;
};

let cache: IonMeasurementsModule | null | undefined;

export async function getIonMeasurementsModule(): Promise<IonMeasurementsModule | null> {
  if (cache !== undefined) return cache;

  try {
    const mod: any = await import("@cesiumgs/ion-sdk-measurements");
    if (!mod?.HeightMeasurement || !mod?.MeasureUnits) return null;
    cache = {
      HeightMeasurement: mod.HeightMeasurement,
      MeasureUnits: mod.MeasureUnits,
      MeasurementMouseHandler: mod.MeasurementMouseHandler,
      DistanceUnits: mod.DistanceUnits
    };
  } catch {
    cache = null;
  }

  return cache;
}

export async function hasIonMeasurements(): Promise<boolean> {
  return (await getIonMeasurementsModule()) !== null;
}