/** Pavement grows outward from the existing curb; motor lanes keep their width.
 * Cap expansion so existing building setbacks are not swallowed by paving. */
export const roadSidewalkConfig={widthScale:1.5,maxExtraPerSide:2,minimumWidth:7.8};
export function roadSidewalkExtra(width:number):number{
 return Math.max(0,Math.min(roadSidewalkConfig.maxExtraPerSide,width*.15625*(roadSidewalkConfig.widthScale-1)));
}
export function roadSidewalkOuterHalfWidth(width:number):number{return Math.max(width*.5+roadSidewalkExtra(width),width*.34375+roadSidewalkConfig.minimumWidth)}

/** Preview uses 8.775 world units per lane. Preserve wider existing roads. */
export function previewRoadRibbonWidth(width:number,lanes:number):number{return Math.max(width,lanes*8.775/.6875)}

/** Edge line is inset from the curb to leave a gutter for drainage. */
export const ROAD_EDGE_LINE_INSET = .8;
export function roadEdgeLineOffset(width:number):number{return Math.max(0,width*.34375-ROAD_EDGE_LINE_INSET)}
/** Centre the parked bus between the outer edge line and next lane divider. */
export function outerLaneCenterOffset(width:number,lanes:number):number{
 const edge=width*.34375,inner=edge-width*.6875/lanes;
 return (roadEdgeLineOffset(width)+inner)*.5;
}
