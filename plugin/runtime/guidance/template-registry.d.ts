import type { AtmosphereBlock, GuidanceSceneType, ImpulseBlock } from "./types.js";
export declare function getBaselineAtmosphereTemplate(): Pick<AtmosphereBlock, "kind" | "text" | "reviewStatus">;
export declare function getImpulseTemplate(sceneType: Exclude<GuidanceSceneType, "explain">): ImpulseBlock;
