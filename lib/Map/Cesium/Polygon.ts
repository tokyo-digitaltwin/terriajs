// @flow
import { point as turfPoint, lineString as turfLineString, polygon as turfPolygon } from '@turf/helpers'
import turfKinks from '@turf/kinks'
import turfBooleanPointOnLine from '@turf/boolean-point-on-line'
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
//import Cartographic from "terriajs-cesium/Source/Core/Cartographic";

export type Point = [number, number];
export type Segment = [Point, Point];
export type PositionsArray=Array<Cartesian3>;
export const MIN_POLYGON_POINTS = 3;

export default class Polygon {
  extractLineSegments (points: Array<Point>) {
    return points.map((point:Point, index) => {
      const p1 = point;
      const p2 = points[index === points.length - 1 ? 0 : index + 1];
      return [p1, p2];
    })
  }
  // 多角形の座標値が正常であるか判定
  validatePolygon (points: PositionsArray) {
    if (!Array.isArray(points)) return false;
    
    type PointsArray=Array<Point>;
    var pointsArray:PointsArray =[];
    for (let i = 0; i < points.length; i++) {
      const pointsCartographic = Ellipsoid.WGS84.cartesianToCartographic(points[i]);
      pointsArray.push([pointsCartographic.longitude,pointsCartographic.latitude]);
    }
  
    if (!this.isNumberPointsLonLat(pointsArray)) return false;
  
    if (pointsArray.length < MIN_POLYGON_POINTS) return false;
  
    if (this.isPointsSamePosition(pointsArray)) return false;
  
    if (this.isPointOnLine(pointsArray)) return false;
  
    if (this.hasCrossingLines(pointsArray)) return false;
  
    return true;
  }
  
  // 緯度経度が数値か確認
  isNumberPointsLonLat (points: Array<Point>) {
    const isNotNumberLonLat = (point:Point) => {
      const [lon, lat] = point;
      return !(typeof lon === 'number' && typeof lat === 'number');
    }
    return !points.some(isNotNumberLonLat);
  }
  
  // 複数の頂点が同一座標にあるか判定を行う
  isPointsSamePosition (points: Array<Point>) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i][0] === points[j][0]  && points[i][1] === points[j][1]) {
          return true;
        }
      }
    }
    return false;
  }
  
  // 頂点が多角形の辺上にあるか判定
  isPointOnLine (points: Array<Point>) {
    const segments = this.extractLineSegments(points)
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < segments.length; j++) {
        const point = turfPoint(points[i])
        const line = turfLineString(segments[j])
        if (turfBooleanPointOnLine(point, line, { ignoreEndVertices: true })) {
          return true;
        }
      }
    }
    return false;
  }
  
  // 多角形の辺が交差しているか判定
  hasCrossingLines(points: Array<Point>) {
    // 交差している点を取得
    var kinks = turfKinks(turfPolygon([[...points, points[0]]]));
    return kinks.features.length > 0;
  }
}