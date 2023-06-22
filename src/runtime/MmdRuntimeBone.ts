import type { Bone} from "@babylonjs/core";
import { Matrix, Quaternion, Space, Vector3 } from "@babylonjs/core";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";

import type { AppendTransformSolver } from "./AppendTransformSolver";
import type { IkSolver } from "./IkSolver";

export class MmdRuntimeBone {
    public readonly babylonBone: Bone;

    public readonly name: string;
    public parentBone: MmdRuntimeBone | null;
    public readonly childrenBones: MmdRuntimeBone[];

    public readonly transformOrder: number;
    public readonly flag: number;
    public readonly transformAfterPhysics: boolean;

    public appendTransformSolver: AppendTransformSolver | null;
    public ikSolver: IkSolver | null;

    public readonly morphPositionOffset: Vector3;
    public readonly morphRotationOffset: Quaternion;

    public readonly localMatrix: Matrix;
    public readonly worldMatrix: Matrix;

    public getAnimatedPositionToRef: (target: Vector3) => Vector3;
    public getAnimatedRotationToRef: (target: Quaternion) => Quaternion;

    public constructor(babylonBone: Bone, boneMetadata: MmdModelMetadata.Bone) {
        this.babylonBone = babylonBone;

        this.name = boneMetadata.name;
        this.parentBone = null;
        this.childrenBones = [];

        this.transformOrder = boneMetadata.transformOrder;
        this.flag = boneMetadata.flag;
        this.transformAfterPhysics = boneMetadata.transformAfterPhysics;

        this.appendTransformSolver = null;
        this.ikSolver = null;

        this.morphPositionOffset = Vector3.Zero();
        this.morphRotationOffset = Quaternion.Identity();

        this.localMatrix = Matrix.Identity();
        this.worldMatrix = babylonBone.getWorldMatrix();

        this.getAnimatedPositionToRef = this._getAnimatedPositionToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationToRef;
    }

    private _getAnimatedPositionWithMorphToRef(target: Vector3): Vector3 {
        this.babylonBone.getPositionToRef(Space.LOCAL, null, target);
        return target.addInPlace(this.morphPositionOffset);
    }

    private _getAnimatedPositionToRef(target: Vector3): Vector3 {
        this.babylonBone.getPositionToRef(Space.LOCAL, null, target);
        return target;
    }

    private _getAnimatedRotationWithMorphToRef(target: Quaternion): Quaternion {
        this.babylonBone.getRotationQuaternionToRef(Space.LOCAL, null, target);
        return target.multiplyInPlace(this.morphRotationOffset);
    }

    private _getAnimatedRotationToRef(target: Quaternion): Quaternion {
        this.babylonBone.getRotationQuaternionToRef(Space.LOCAL, null, target);
        return target;
    }

    public enableMorph(): void {
        this.getAnimatedPositionToRef = this._getAnimatedPositionWithMorphToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationWithMorphToRef;
    }

    public disableMorph(): void {
        this.getAnimatedPositionToRef = this._getAnimatedPositionToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationToRef;
    }

    private static readonly _TempScale = Vector3.Zero();
    private static readonly _TempRotation = Quaternion.Identity();
    private static readonly _TempPosition = Vector3.Zero();

    public updateLocalMatrix(): void {
        this.babylonBone.getScaleToRef(MmdRuntimeBone._TempScale);
        const rotation = this.getAnimatedRotationToRef(MmdRuntimeBone._TempRotation);
        const position = this.getAnimatedPositionToRef(MmdRuntimeBone._TempPosition);

        if (this.ikSolver !== null) {
            this.ikSolver.ikRotation.multiplyToRef(rotation, rotation);
        }

        Matrix.ComposeToRef(
            MmdRuntimeBone._TempScale,
            rotation,
            position,
            this.localMatrix
        );
    }

    private static readonly _Stack: MmdRuntimeBone[] = [];

    public updateWorldMatrix(): void {
        const stack = MmdRuntimeBone._Stack;
        stack.length = 0;
        stack.push(this);

        while (stack.length > 0) {
            const bone = stack.pop()!;

            const parentBone = bone.parentBone;
            if (parentBone !== null) {
                bone.localMatrix.multiplyToRef(parentBone.worldMatrix, bone.worldMatrix);
            } else {
                bone.worldMatrix.copyFrom(bone.localMatrix);
            }

            const childrenBones = bone.childrenBones;
            for (let i = 0, l = childrenBones.length; i < l; ++i) {
                stack.push(childrenBones[i]);
            }
        }
    }
}