import type { Material, Mesh, Scene } from "@babylonjs/core";
import { Logger } from "@babylonjs/core";

import type { MmdRuntimeCameraAnimation, MmdRuntimeModelAnimation } from "./animation/MmdRuntimeAnimation";
import type { IAudioPlayer } from "./audio/IAudioPlayer";
import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdCamera } from "./MmdCamera";
import { MmdMesh } from "./MmdMesh";
import { MmdModel } from "./MmdModel";
import type { MmdPhysics } from "./MmdPhysics";
import { MmdStandardMaterialProxy } from "./MmdStandardMaterialProxy";

export interface CreateMmdModelOptions {
    materialProxyConstructor?: IMmdMaterialProxyConstructor<Material>;
    buildPhysics?: boolean;
}

export class MmdRuntime implements ILogger {
    private readonly _physics: MmdPhysics | null;

    private readonly _models: MmdModel[];
    private _camera: MmdCamera | null;
    private _audioPlayer: IAudioPlayer | null;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    private _isRegistered: boolean;

    private _currentFrameTime: number;
    private _animationTimeScale: number;
    private _animationPaused: boolean;
    private _animationDuration: number;
    private _useManualAnimationDuration: boolean;

    private readonly _needToInitializePhysicsModels: Set<MmdModel>;

    private _beforePhysicsBinded: (() => void) | null;
    private readonly _afterPhysicsBinded: () => void;

    public constructor(physics?: MmdPhysics) {
        this._physics = physics ?? null;

        this._models = [];
        this._camera = null;
        this._audioPlayer = null;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._isRegistered = false;

        this._currentFrameTime = 0;
        this._animationTimeScale = 1;
        this._animationPaused = true;
        this._animationDuration = 0;
        this._useManualAnimationDuration = false;

        this._needToInitializePhysicsModels = new Set<MmdModel>();

        this._beforePhysicsBinded = null;
        this._afterPhysicsBinded = this.afterPhysics.bind(this);
    }

    public createMmdModel(
        mmdMesh: Mesh,
        options: CreateMmdModelOptions = {}
    ): MmdModel {
        if (!MmdMesh.isMmdMesh(mmdMesh)) throw new Error("Mesh validation failed.");

        if (options.materialProxyConstructor === undefined) {
            options.materialProxyConstructor = MmdStandardMaterialProxy as unknown as IMmdMaterialProxyConstructor<Material>;
        }
        if (options.buildPhysics === undefined) {
            options.buildPhysics = true;
        }

        const model = new MmdModel(
            mmdMesh,
            options.materialProxyConstructor,
            options.buildPhysics ? this._physics : null,
            this
        );
        this._models.push(model);
        this._needToInitializePhysicsModels.add(model);

        model.onCurrentAnimationChangedObservable.add(this._onAnimationChanged);

        return model;
    }

    public destroyMmdModel(mmdModel: MmdModel): void {
        mmdModel.dispose();

        const models = this._models;
        const index = models.indexOf(mmdModel);
        if (index < 0) throw new Error("Model not found.");

        models.splice(index, 1);
    }

    public setCamera(camera: MmdCamera | null): void {
        if (this._camera !== null) {
            this._camera.onCurrentAnimationChangedObservable.removeCallback(this._onAnimationChanged);
        }

        if (camera !== null) {
            camera.onCurrentAnimationChangedObservable.add(this._onAnimationChanged);
        }
        this._camera = camera;
    }

    public async setAudioPlayer(audioPlayer: IAudioPlayer | null): Promise<void> {
        if (this._audioPlayer !== null) {
            this._audioPlayer.onDurationChangedObservable.removeCallback(this._onAudioDurationChanged);
            this._audioPlayer.onPlaybackRateChangedObservable.removeCallback(this._onAudioPlaybackRateChanged);
            this._audioPlayer.onPlayObservable.removeCallback(this._onAudioPlay);
            this._audioPlayer.onPauseObservable.removeCallback(this._onAudioPause);
            this._audioPlayer.onSeekObservable.removeCallback(this._onAudioSeek);
            this._audioPlayer.pause();
        }

        if (audioPlayer === null) return;

        this._audioPlayer = null;
        if (!this._animationPaused) {
            if (this._currentFrameTime < this._animationDuration) {
                audioPlayer.currentTime = this._currentFrameTime / 30;
                await audioPlayer.play();
            }
        }
        this._audioPlayer = audioPlayer;

        audioPlayer.onDurationChangedObservable.add(this._onAudioDurationChanged);
        audioPlayer.onPlaybackRateChangedObservable.add(this._onAudioPlaybackRateChanged);
        audioPlayer.onPlayObservable.add(this._onAudioPlay);
        audioPlayer.onPauseObservable.add(this._onAudioPause);
        audioPlayer.onSeekObservable.add(this._onAudioSeek);
        audioPlayer._setPlaybackRateWithoutNotify(this._animationTimeScale);

    }

    public register(scene: Scene): void {
        if (this._isRegistered) return;
        this._isRegistered = true;

        this._beforePhysicsBinded = (): void => this.beforePhysics(scene.getEngine().getDeltaTime());

        scene.onBeforeAnimationsObservable.add(this._beforePhysicsBinded);
        scene.onBeforeRenderObservable.add(this._afterPhysicsBinded);
    }

    public unregister(scene: Scene): void {
        if (!this._isRegistered) return;
        this._isRegistered = false;

        scene.onBeforeAnimationsObservable.removeCallback(this._beforePhysicsBinded!);
        scene.onBeforeRenderObservable.removeCallback(this._afterPhysicsBinded);

        this._beforePhysicsBinded = null;
    }

    public beforePhysics(deltaTime: number): void {
        if (!this._animationPaused) {
            if (this._audioPlayer !== null && !this._audioPlayer.paused) { // sync animation time with audio time
                const timeDiff = this._audioPlayer.currentTime - this._currentFrameTime / 30;
                const timeDiffAbs = Math.abs(timeDiff);
                if (timeDiffAbs < 0.05) { // synced
                    this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale;
                } else if (timeDiffAbs < 0.5) {
                    if (timeDiff < 0) { // animation is faster than audio
                        this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale * 0.9;
                    } else { // animation is slower than audio
                        this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale * 1.1;
                    }
                } else {
                    this._currentFrameTime = this._audioPlayer.currentTime * 30;
                }
            } else { // only use delta time to calculate animation time
                this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale;
            }

            const elapsedFrameTime = this._currentFrameTime;

            if (this._animationDuration <= elapsedFrameTime) {
                this._animationPaused = true;
                this._currentFrameTime = this._animationDuration;
            }

            const models = this._models;
            for (let i = 0; i < models.length; ++i) {
                models[i].beforePhysics(elapsedFrameTime);
            }

            if (this._camera !== null) {
                this._camera.animate(elapsedFrameTime);
            }
        } else {
            const models = this._models;
            for (let i = 0; i < models.length; ++i) {
                models[i].beforePhysics(null);
            }
        }

        const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
        for (const model of needToInitializePhysicsModels) {
            model.initializePhysics();
        }
        needToInitializePhysicsModels.clear();
    }

    public afterPhysics(): void {
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            models[i].afterPhysics();
        }
    }

    private readonly _onAnimationChanged = (newAnimation: MmdRuntimeCameraAnimation | MmdRuntimeModelAnimation | null): void => {
        if (this._useManualAnimationDuration) return;

        const newAnimationDuration = newAnimation?.animation.endFrame ?? 0;

        if (this._animationDuration < newAnimationDuration) {
            this._animationDuration = newAnimationDuration;
        } else if (newAnimationDuration < this._animationDuration) {
            this._animationDuration = this._computeAnimationDuration();
        }
    };

    private _computeAnimationDuration(): number {
        let duration = 0;
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            const model = models[i];
            if (model.currentAnimation !== null) {
                duration = Math.max(duration, model.currentAnimation.animation.endFrame);
            }
        }

        if (this._camera !== null && this._camera.currentAnimation !== null) {
            duration = Math.max(duration, this._camera.currentAnimation.animation.endFrame);
        }

        if (this._audioPlayer !== null) {
            duration = Math.max(duration, this._audioPlayer.duration * 30);
        }

        return duration;
    }

    private readonly _onAudioDurationChanged = (): void => {
        if (this._useManualAnimationDuration) return;
        this._animationDuration = this._computeAnimationDuration();
    };

    private readonly _onAudioPlaybackRateChanged = (): void => {
        this._animationTimeScale = this._audioPlayer!.playbackRate;
    };

    private readonly _onAudioPlay = (): void => {
        this._playAnimationInternal();
    };

    private readonly _onAudioPause = (): void => {
        if (this._audioPlayer!.currentTime === this._audioPlayer!.duration) return;
        this._animationPaused = true;
    };

    private readonly _onAudioSeek = (): void => {
        this._seekAnimationInternal(this._audioPlayer!.currentTime * 30, this._animationPaused);
    };

    private _playAnimationInternal(): void {
        if (!this._animationPaused) return;
        this._animationPaused = false;

        const models = this._models;
        for (let i = 0; i < this._models.length; ++i) {
            const model = models[i];
            model.resetState();
            this._needToInitializePhysicsModels.add(model);
        }

        if (!this._useManualAnimationDuration && this._currentFrameTime === 0) {
            this._animationDuration = this._computeAnimationDuration();
        }
    }

    public async playAnimation(): Promise<void> {
        if (this._audioPlayer !== null) {
            try {
                await this._audioPlayer.play();
            } catch (e) {
                if (e instanceof DOMException && e.name === "NotSupportedError") {
                    this.error("Failed to play audio.");
                    this._playAnimationInternal();
                } else {
                    throw e;
                }
            }
        } else {
            this._playAnimationInternal();
        }
    }

    public pauseAnimation(): void {
        if (this._audioPlayer !== null) {
            this._audioPlayer.pause();
        } else {
            this._animationPaused = true;
        }
    }

    private _seekAnimationInternal(frameTime: number, forceEvaluate: boolean): void {
        if (2 * 30 < Math.abs(frameTime - this._currentFrameTime)) {
            const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
            for (let i = 0; i < this._models.length; ++i) {
                const model = this._models[i];
                if (model.currentAnimation !== null) {
                    needToInitializePhysicsModels.add(model);
                }
            }
        }

        this._currentFrameTime = frameTime;

        if (forceEvaluate) {
            const originalPaused = this._animationPaused;
            this._animationPaused = false;
            this.beforePhysics(0);
            this._animationPaused = originalPaused;
        }
    }

    public seekAnimation(frameTime: number, forceEvaluate: boolean = false): void {
        frameTime = Math.max(0, Math.min(frameTime, this._animationDuration));

        if (this._audioPlayer !== null && !this._audioPlayer.paused) {
            this._audioPlayer.currentTime = frameTime / 30;
        } else {
            this._seekAnimationInternal(frameTime, forceEvaluate);
            this._audioPlayer?._setCurrentTimeWithoutNotify(frameTime / 30);
        }
    }

    public get isAnimationPlaying(): boolean {
        return !this._animationPaused;
    }

    public get models(): readonly MmdModel[] {
        return this._models;
    }

    public get camera(): MmdCamera | null {
        return this._camera;
    }

    public get audioPlayer(): IAudioPlayer | null {
        return this._audioPlayer;
    }

    public get timeScale(): number {
        return this._animationTimeScale;
    }

    public set timeScale(value: number) {
        this._animationTimeScale = value;

        if (this._audioPlayer !== null) {
            this._audioPlayer._setPlaybackRateWithoutNotify(value);
        }
    }

    public get currentFrameTime(): number {
        return this._currentFrameTime;
    }

    public get currentTime(): number {
        return this._currentFrameTime / 30;
    }

    public get animationDuration(): number | null {
        return this._animationDuration;
    }

    public setManualAnimationDuration(duration: number | null): void {
        if (duration === null) {
            this._useManualAnimationDuration = false;
            this._animationDuration = this._computeAnimationDuration();
        } else {
            this._useManualAnimationDuration = true;
            this._animationDuration = duration;
        }
    }

    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this._logEnabled;
            this.warn = this._warnEnabled;
            this.error = this._errorEnabled;
        } else {
            this.log = this._logDisabled;
            this.warn = this._warnDisabled;
            this.error = this._errorDisabled;
        }
    }

    private _logEnabled(message: string): void {
        Logger.Log(message);
    }

    private _logDisabled(): void {
        // do nothing
    }

    private _warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private _warnDisabled(): void {
        // do nothing
    }

    private _errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private _errorDisabled(): void {
        // do nothing
    }
}
