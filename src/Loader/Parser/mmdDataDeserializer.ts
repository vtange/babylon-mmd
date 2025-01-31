type TupleOf<T, N extends number, R extends unknown[]> =
    R["length"] extends N ? R : TupleOf<T, N, [T, ...R]>;

type Tuple<T, N extends number> = N extends N
    ? number extends N ? T[] : TupleOf<T, N, []>
    : never;

export class MmdDataDeserializer {
    public readonly isDeviceLittleEndian: boolean;
    private readonly _dataView: DataView;
    private _decoder: TextDecoder | null;
    private _offset: number;

    public constructor(arrayBuffer: ArrayBufferLike) {
        this.isDeviceLittleEndian = this._getIsDeviceLittleEndian();
        this._dataView = new DataView(arrayBuffer);
        this._decoder = null;
        this._offset = 0;
    }

    public get offset(): number {
        return this._offset;
    }

    public set offset(value: number) {
        this._offset = value;
    }

    private _getIsDeviceLittleEndian(): boolean {
        const array = new Int16Array([256]);
        return new Int8Array(array.buffer)[1] === 1;
    }

    public swap16Array(array: Int16Array | Uint16Array): void {
        for (let i = 0; i < array.length; ++i) {
            const value = array[i];
            array[i] = ((value & 0xFF) << 8) | ((value >> 8) & 0xFF);
        }
    }

    public swap32Array(array: Int32Array | Uint32Array | Float32Array): void {
        for (let i = 0; i < array.length; ++i) {
            const value = array[i];
            array[i] = ((value & 0xFF) << 24) | ((value & 0xFF00) << 8) | ((value >> 8) & 0xFF00) | ((value >> 24) & 0xFF);
        }
    }

    public getUint8(): number {
        const value = this._dataView.getUint8(this._offset);
        this._offset += 1;
        return value;
    }

    public getInt8(): number {
        const value = this._dataView.getInt8(this._offset);
        this._offset += 1;
        return value;
    }

    public getUint8Array(dest: Uint8Array): void {
        const source = new Uint8Array(this._dataView.buffer, this._offset, dest.byteLength);
        dest.set(source);
        this._offset += dest.byteLength;
    }

    public getUint16(): number {
        const value = this._dataView.getUint16(this._offset, true);
        this._offset += 2;
        return value;
    }

    public getUint16Array(dest: Uint16Array): void {
        const source = new Uint8Array(this._dataView.buffer, this._offset, dest.byteLength);
        new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength).set(source);
        this._offset += dest.byteLength;

        if (!this.isDeviceLittleEndian) this.swap16Array(dest);
    }

    public getInt16(): number {
        const value = this._dataView.getInt16(this._offset, true);
        this._offset += 2;
        return value;
    }

    public getUint32(): number {
        const value = this._dataView.getUint32(this._offset, true);
        this._offset += 4;
        return value;
    }

    public getUint32Array(dest: Uint32Array): void {
        const source = new Uint8Array(this._dataView.buffer, this._offset, dest.byteLength);
        new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength).set(source);
        this._offset += dest.byteLength;

        if (!this.isDeviceLittleEndian) this.swap32Array(dest);
    }

    public getInt32(): number {
        const value = this._dataView.getInt32(this._offset, true);
        this._offset += 4;
        return value;
    }

    public getInt32Array(dest: Int32Array): void {
        const source = new Uint8Array(this._dataView.buffer, this._offset, dest.byteLength);
        new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength).set(source);
        this._offset += dest.byteLength;

        if (!this.isDeviceLittleEndian) this.swap32Array(dest);
    }

    public getFloat32(): number {
        const value = this._dataView.getFloat32(this._offset, true);
        this._offset += 4;
        return value;
    }

    public getFloat32Array(dest: Float32Array): void {
        const source = new Uint8Array(this._dataView.buffer, this._offset, dest.byteLength);
        new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength).set(source);
        this._offset += dest.byteLength;

        if (!this.isDeviceLittleEndian) this.swap32Array(dest);
    }

    public getFloat32Tuple<N extends number>(length: N): Tuple<number, N> {
        const result = new Array<number>(length);
        for (let i = 0; i < length; ++i) {
            result[i] = this._dataView.getFloat32(this._offset, true);
            this._offset += 4;
        }
        return result as Tuple<number, N>;
    }

    public initializeTextDecoder(encoding: string): void {
        this._decoder = new TextDecoder(encoding);
    }

    public getDecoderString(length: number, trim: boolean): string {
        if (this._decoder === null) {
            throw new Error("TextDecoder is not initialized.");
        }

        let bytes = new Uint8Array(this._dataView.buffer, this._offset, length);
        this._offset += length;

        if (trim) {
            for (let i = 0; i < bytes.length; ++i) {
                if (bytes[i] === 0) {
                    bytes = bytes.subarray(0, i);
                    break;
                }
            }
        }

        return this._decoder.decode(bytes);
    }

    public getSignatureString(length: number): string {
        const decoder = new TextDecoder("utf-8");
        const bytes = new Uint8Array(this._dataView.buffer, this._offset, length);
        this._offset += length;

        return decoder.decode(bytes);
    }

    public getPaddedArrayOffset(elementSize: number, length: number): number {
        this._offset += this._offset % elementSize === 0 ? 0 : elementSize - this._offset % elementSize;
        const offset = this._offset;
        this._offset += elementSize * length;

        return offset;
    }

    public get bytesAvailable(): number {
        return this._dataView.byteLength - this._offset;
    }
}
