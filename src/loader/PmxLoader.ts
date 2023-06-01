import type { IFileRequest, ISceneLoaderAsyncResult, ISceneLoaderPluginAsync, ISceneLoaderPluginExtensions, ISceneLoaderProgressEvent, LoadFileError, Scene, WebRequest } from "@babylonjs/core";
import { MorphTarget } from "@babylonjs/core";
import { MorphTargetManager } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import { Bone, Matrix } from "@babylonjs/core";
import { Skeleton } from "@babylonjs/core";
import { AssetContainer, Geometry, Mesh, MultiMaterial, SubMesh, Tools, VertexData } from "@babylonjs/core";

import type { IMmdMaterialBuilder } from "./IMmdMaterialBuilder";
import { MmdStandardMaterialBuilder } from "./MmdStandardMaterialBuilder";
import { PmxObject } from "./parser/PmxObject";
import { PmxReader } from "./parser/PmxReader";

export class PmxLoader implements ISceneLoaderPluginAsync {
    /**
     * Name of the loader ("pmx")
     */
    public name: string;
    public extensions: ISceneLoaderPluginExtensions;

    public materialBuilder: IMmdMaterialBuilder;

    public constructor() {
        this.name = "pmx";
        this.extensions = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".pmx": { isBinary: true }
        };

        this.materialBuilder = new MmdStandardMaterialBuilder();
    }

    public importMeshAsync(
        meshesNames: any,
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<ISceneLoaderAsyncResult> {
        // meshesNames type is string | string[] | any
        // you can select
        meshesNames;
        scene;
        data;
        rootUrl;
        onProgress;
        fileName;
        console.log("importMesh");
        throw new Error("Method not implemented.");
    }

    public async loadAsync(
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<void> {
        // data must be ArrayBuffer
        const pmxObject = await PmxReader.parseAsync(data)
            .catch((e: any) => {
                return Promise.reject(e);
            });

        const mesh = new Mesh(pmxObject.header.modelName, scene);

        const vertexData = new VertexData();
        {
            const vertices = pmxObject.vertices;
            const positions = new Float32Array(vertices.length * 3);
            const normals = new Float32Array(vertices.length * 3);
            const uvs = new Float32Array(vertices.length * 2);
            const boneIndices = new Float32Array(vertices.length * 4);
            const boneWeights = new Float32Array(vertices.length * 4);

            let indices;
            if (pmxObject.faces instanceof Uint8Array || pmxObject.faces instanceof Uint16Array) {
                indices = new Uint16Array(pmxObject.faces.length);
            } else {
                indices = new Uint32Array(pmxObject.faces.length);
            }
            {
                let time = performance.now();
                for (let i = 0; i < indices.length; i += 3) { // reverse winding order
                    indices[i + 0] = pmxObject.faces[i + 0];
                    indices[i + 1] = pmxObject.faces[i + 2];
                    indices[i + 2] = pmxObject.faces[i + 1];

                    if (i % 10000 === 0 && 100 < performance.now() - time) {
                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }
            }

            {
                let time = performance.now();
                for (let i = 0; i < vertices.length; ++i) {
                    const vertex = vertices[i];
                    positions[i * 3 + 0] = vertex.position[0];
                    positions[i * 3 + 1] = vertex.position[1];
                    positions[i * 3 + 2] = vertex.position[2];

                    normals[i * 3 + 0] = vertex.normal[0];
                    normals[i * 3 + 1] = vertex.normal[1];
                    normals[i * 3 + 2] = vertex.normal[2];

                    uvs[i * 2 + 0] = vertex.uv[0];
                    uvs[i * 2 + 1] = 1 - vertex.uv[1]; // flip y axis

                    switch (vertex.weightType) {
                    case PmxObject.Vertex.BoneWeightType.bdef1:
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef1>;

                            boneIndices[i * 4 + 0] = boneWeight.boneIndices;
                            boneIndices[i * 4 + 1] = 0;
                            boneIndices[i * 4 + 2] = 0;
                            boneIndices[i * 4 + 3] = 0;

                            boneWeights[i * 4 + 0] = 1;
                            boneWeights[i * 4 + 1] = 0;
                            boneWeights[i * 4 + 2] = 0;
                            boneWeights[i * 4 + 3] = 0;
                        }
                        break;

                    case PmxObject.Vertex.BoneWeightType.bdef2:
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef2>;

                            boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                            boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                            boneIndices[i * 4 + 2] = 0;
                            boneIndices[i * 4 + 3] = 0;

                            boneWeights[i * 4 + 0] = boneWeight.boneWeights;
                            boneWeights[i * 4 + 1] = 1 - boneWeight.boneWeights;
                            boneWeights[i * 4 + 2] = 0;
                            boneWeights[i * 4 + 3] = 0;
                        }
                        break;

                    case PmxObject.Vertex.BoneWeightType.bdef4:
                    case PmxObject.Vertex.BoneWeightType.qdef: // pmx 2.1 not support fallback to bdef4
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef4>;

                            boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                            boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                            boneIndices[i * 4 + 2] = boneWeight.boneIndices[2];
                            boneIndices[i * 4 + 3] = boneWeight.boneIndices[3];

                            boneWeights[i * 4 + 0] = boneWeight.boneWeights[0];
                            boneWeights[i * 4 + 1] = boneWeight.boneWeights[1];
                            boneWeights[i * 4 + 2] = boneWeight.boneWeights[2];
                            boneWeights[i * 4 + 3] = boneWeight.boneWeights[3];
                        }
                        break;

                    case PmxObject.Vertex.BoneWeightType.sdef:
                        {
                            // todo: implement sdef

                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.sdef>;

                            boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                            boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                            boneIndices[i * 4 + 2] = 0;
                            boneIndices[i * 4 + 3] = 0;

                            boneWeights[i * 4 + 0] = boneWeight.boneWeights.boneWeight0;
                            boneWeights[i * 4 + 1] = 1 - boneWeight.boneWeights.boneWeight0;
                            boneWeights[i * 4 + 2] = 0;
                            boneWeights[i * 4 + 3] = 0;
                        }
                        break;
                    }

                    if (i % 10000 === 0 && 100 < performance.now() - time) {
                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }
            }

            vertexData.positions = positions;
            vertexData.normals = normals;
            vertexData.uvs = uvs;
            vertexData.indices = indices;
            vertexData.matricesIndices = boneIndices;
            vertexData.matricesWeights = boneWeights;
        }

        const geometry = new Geometry(pmxObject.header.modelName, scene, vertexData, false);
        geometry.applyToMesh(mesh);

        const multiMaterial = new MultiMaterial(pmxObject.header.modelName + "_multi", scene);
        const buildMaterialsPromise = this.materialBuilder.buildMaterials(
            pmxObject,
            rootUrl,
            scene,
            vertexData.indices,
            vertexData.uvs,
            multiMaterial
        );
        if (buildMaterialsPromise !== undefined) {
            await buildMaterialsPromise;
        }
        mesh.material = multiMaterial;

        mesh.subMeshes.length = 0;
        {
            const materials = pmxObject.materials;
            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                new SubMesh(
                    i, // materialIndex
                    0, // verticesStart
                    pmxObject.vertices.length, // verticesCount
                    offset, // indexStart
                    materialInfo.surfaceCount, // indexCount
                    mesh
                );

                offset += materialInfo.surfaceCount;
            }
        }

        const skeleton = new Skeleton(pmxObject.header.modelName, pmxObject.header.modelName + "_skeleton", scene);
        {
            const bonesInfo = pmxObject.bones;
            {
                const bones: Bone[] = [];

                for (let i = 0; i < bonesInfo.length; ++i) {
                    const boneInfo = bonesInfo[i];
                    const boneWorldPosition = boneInfo.position;

                    const bonePosition = new Vector3(boneWorldPosition[0], boneWorldPosition[1], boneWorldPosition[2]);
                    if (boneInfo.parentBoneIndex !== -1) {
                        const parentBoneInfo = bonesInfo[boneInfo.parentBoneIndex];
                        bonePosition.x -= parentBoneInfo.position[0];
                        bonePosition.y -= parentBoneInfo.position[1];
                        bonePosition.z -= parentBoneInfo.position[2];
                    }
                    const boneMatrix = Matrix.Identity()
                        .setTranslation(bonePosition);

                    const bone = new Bone(
                        boneInfo.name,
                        skeleton,
                        undefined,
                        boneMatrix,
                        undefined,
                        undefined,
                        i // bone index
                    );
                    bones.push(bone);
                }

                for (let i = 0; i < bones.length; ++i) {
                    const boneInfo = bonesInfo[i];
                    const bone = bones[i];

                    if (boneInfo.parentBoneIndex !== -1) {
                        bone.setParent(bones[boneInfo.parentBoneIndex]);
                    }
                }
            }
        }
        mesh.skeleton = skeleton;

        const morphTargetManager = new MorphTargetManager();
        {
            const morphsInfo = pmxObject.morphs;

            for (let i = 0; i < morphsInfo.length; ++i) {
                const morphInfo = morphsInfo[i];
                if (
                    morphInfo.type !== PmxObject.Morph.Type.vertexMorph &&
                    morphInfo.type !== PmxObject.Morph.Type.uvMorph
                ) {
                    // group morph, bone morph, material morph will be handled by cpu bound custom runtime
                    continue;
                }

                const morphTarget = new MorphTarget(morphInfo.name, 0, scene);

                if (morphInfo.type === PmxObject.Morph.Type.vertexMorph) {
                    const positions = new Float32Array(pmxObject.vertices.length * 3);
                    positions.set(vertexData.positions);

                    const elements = morphInfo.elements as PmxObject.Morph.VertexMorph[];
                    let time = performance.now();
                    for (let i = 0; i < elements.length; ++i) {
                        const element = elements[i];
                        const elementIndex = element.index;
                        const elementPosition = element.position;
                        positions[elementIndex * 3 + 0] += elementPosition[0];
                        positions[elementIndex * 3 + 1] += elementPosition[1];
                        positions[elementIndex * 3 + 2] += elementPosition[2];

                        if (i % 10000 === 0 && 100 < performance.now() - time) {
                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }

                    morphTarget.setPositions(positions);
                } else /*if (morphInfo.type === PmxObject.Morph.Type.uvMorph)*/ {
                    const uvs = new Float32Array(pmxObject.vertices.length * 2);
                    uvs.set(vertexData.uvs);

                    const elements = morphInfo.elements as PmxObject.Morph.UvMorph[];
                    let time = performance.now();
                    for (let i = 0; i < elements.length; ++i) {
                        const element = elements[i];
                        const elementIndex = element.index;
                        const elementUvOffset = element.offset;

                        // todo: fix uv morph
                        uvs[elementIndex * 2 + 0] += elementUvOffset[0];
                        uvs[elementIndex * 2 + 0] *= elementUvOffset[1];

                        uvs[elementIndex * 2 + 1] += elementUvOffset[2];
                        uvs[elementIndex * 2 + 1] *= elementUvOffset[3];

                        if (i % 10000 === 0 && 100 < performance.now() - time) {
                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }
                }

                morphTargetManager.addTarget(morphTarget);
            }
        }
        mesh.morphTargetManager = morphTargetManager;

        onProgress;
        fileName;
    }

    public loadAssetContainerAsync(
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<AssetContainer> {
        const assetContainer = new AssetContainer(scene);
        data;
        rootUrl;
        onProgress;
        fileName;
        return Promise.resolve(assetContainer);
    }

    public loadFile(
        scene: Scene,
        fileOrUrl: string | File,
        onSuccess: (data: any, responseURL?: string | undefined) => void,
        onProgress?: ((ev: ISceneLoaderProgressEvent) => void) | undefined,
        useArrayBuffer?: boolean | undefined,
        onError?: ((request?: WebRequest | undefined, exception?: LoadFileError | undefined) => void) | undefined
    ): IFileRequest {
        const request = scene._loadFile(
            fileOrUrl,
            onSuccess,
            onProgress,
            true,
            useArrayBuffer,
            onError
        );
        return request;
    }
}
