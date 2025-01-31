import type { PmxObject } from "./Parser/pmxObject";

/**
 * Mmd model metadata
 *
 * Metadata for construct a `MmdModel` from mmd mesh
 *
 * You can also put MmdModelMetadata into a non-mmd mesh as metadata to make it work by mmd runtime
 */
export interface MmdModelMetadata {
    /**
     * Indicate this mesh.metadata is a mmd model metadata
     */
    readonly isMmdModel: true;

    /**
     * Mmd model header
     */
    readonly header: MmdModelMetadata.Header;

    /**
     * Mmd model bones information
     */
    readonly bones: readonly MmdModelMetadata.Bone[];

    /**
     * Mmd model morphs information
     */
    readonly morphs: readonly MmdModelMetadata.Morph[];

    /**
     * Mmd model rigid bodies information
     */
    readonly rigidBodies: PmxObject["rigidBodies"];

    /**
     * Mmd model joints information
     */
    readonly joints: PmxObject["joints"];
}

export namespace MmdModelMetadata {
    /**
     * Mmd model metadata header
     */
    export interface Header {
        /**
         * Model name
         */
        readonly modelName: PmxObject.Header["modelName"];

        /**
         * Model name in english
         */
        readonly englishModelName: PmxObject.Header["englishModelName"];

        /**
         * Model comment
         */
        readonly comment: PmxObject.Header["comment"];

        /**
         * Model comment in english
         */
        readonly englishComment: PmxObject.Header["englishComment"];
    }

    /**
     * Mmd model morph information
     */
    export type Morph = GroupMorph | BoneMorph | MaterialMorph | VertexMorph | UvMorph;

    /**
     * Base morph information
     */
    export interface BaseMorph {
        /**
         * Morph name
         */
        readonly name: PmxObject.Morph["name"];

        /**
         * Morph name in english
         */
        readonly englishName: PmxObject.Morph["englishName"];

        /**
         * Morph category
         */
        readonly category: PmxObject.Morph["category"];

        /**
         * Morph type
         */
        readonly type: PmxObject.Morph["type"];
    }

    /**
     * Group morph information
     */
    export interface GroupMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.GroupMorph["type"];

        /**
         * Morph indices
         */
        readonly indices: PmxObject.Morph.GroupMorph["indices"];

        /**
         * Morph ratios
         */
        readonly ratios: PmxObject.Morph.GroupMorph["ratios"];
    }

    /**
     * Bone morph information
     */
    export interface BoneMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.BoneMorph["type"];

        /**
         * Morph indices
         */
        readonly indices: PmxObject.Morph.BoneMorph["indices"];

        /**
         * Morph positions
         *
         * Repr: [..., x, y, z, ...]
         */
        readonly positions: PmxObject.Morph.BoneMorph["positions"];

        /**
         * Morph rotations in quaternion
         *
         * Repr: [..., x, y, z, w, ...]
         */
        readonly rotations: PmxObject.Morph.BoneMorph["rotations"];
    }

    /**
     * Material morph information
     */
    export interface MaterialMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.MaterialMorph["type"];

        /**
         * Morph elements
         *
         * @see PmxObject.Morph.MaterialMorph["elements"]
         */
        readonly elements: PmxObject.Morph.MaterialMorph["elements"];
    }

    /**
     * Vertex morph information
     */
    export interface VertexMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.VertexMorph["type"];

        /**
         * `mesh.morphTargetManager` morph target index
         */
        readonly index: number;
    }

    /**
     * UV morph information
     */
    export interface UvMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.UvMorph["type"];

        /**
         * `mesh.morphTargetManager` morph target index
         */
        readonly index: number;
    }

    /**
     * Mmd model bone information
     */
    export interface Bone {
        /**
         * Bone name
         */
        readonly name: PmxObject.Bone["name"];

        /**
         * Parent bone index
         */
        readonly parentBoneIndex: PmxObject.Bone["parentBoneIndex"];

        /**
         * Transform order
         *
         * @see PmxObject.Bone["transformOrder"]
         */
        readonly transformOrder: PmxObject.Bone["transformOrder"];

        /**
         * Bone flag
         *
         * @see PmxObject.Bone.Flag
         */
        readonly flag: PmxObject.Bone["flag"];

        /**
         * Append transform (optional)
         *
         * @see PmxObject.Bone["appendTransform"]
         */
        readonly appendTransform: PmxObject.Bone["appendTransform"];

        // readonly axisLimit: PmxObject.Bone["axisLimit"];
        // readonly localVector: PmxObject.Bone["localVector"];

        /**
         * Transform after physics (optional)
         *
         * @see PmxObject.Bone["transformAfterPhysics"]
         */
        readonly transformAfterPhysics: PmxObject.Bone["transformAfterPhysics"];

        // readonly externalParentTransform: PmxObject.Bone["externalParentTransform"];

        /**
         * IK information (optional)
         *
         * @see PmxObject.Bone["ik"]
         */
        readonly ik: PmxObject.Bone["ik"];
    }
}
