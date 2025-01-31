export class MmdDataSerializer {
    private readonly _dataView: DataView;
    private readonly _encoder: TextEncoder;
    private _offset: number;

    public constructor(arrayBuffer: ArrayBufferLike) {
        this._dataView = new DataView(arrayBuffer);
        this._encoder = new TextEncoder();
        this._offset = 0;
    }

    public get offset(): number {
        return this._offset;
    }

    public set offset(value: number) {
        this._offset = value;
    }

    public setUint8(value: number): void {
        this._dataView.setUint8(this._offset, value);
        this._offset += 1;
    }

    public setUint8Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setUint8(this._offset, values[i]);
            this._offset += 1;
        }
    }

    public setInt8(value: number): void {
        this._dataView.setInt8(this._offset, value);
        this._offset += 1;
    }

    public setInt8Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setInt8(this._offset, values[i]);
            this._offset += 1;
        }
    }

    public setUint16(value: number): void {
        this._dataView.setUint16(this._offset, value, true);
        this._offset += 2;
    }

    public setUint16Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setUint16(this._offset, values[i], true);
            this._offset += 2;
        }
    }

    public setUint32(value: number): void {
        this._dataView.setUint32(this._offset, value, true);
        this._offset += 4;
    }

    public setUint32Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setUint32(this._offset, values[i], true);
            this._offset += 4;
        }
    }

    public setInt32(value: number): void {
        this._dataView.setInt32(this._offset, value, true);
        this._offset += 4;
    }

    public setInt32Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setInt32(this._offset, values[i], true);
            this._offset += 4;
        }
    }

    public setFloat32(value: number): void {
        this._dataView.setFloat32(this._offset, value, true);
        this._offset += 4;
    }

    public setFloat32Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setFloat32(this._offset, values[i], true);
            this._offset += 4;
        }
    }

    public setString(value: string): void {
        const dataView = this._dataView;
        const bytes = this._encoder.encode(value);
        dataView.setUint32(this._offset, bytes.length, true);
        this._offset += 4;
        for (let i = 0; i < bytes.length; ++i) {
            dataView.setUint8(this._offset, bytes[i]);
            this._offset += 1;
        }
    }

    public get bytesAvailable(): number {
        return this._dataView.byteLength - this._offset;
    }

    public static Padding(offset: number, elementSize: number): number {
        return offset % elementSize === 0 ? 0 : elementSize - offset % elementSize;
    }
}
