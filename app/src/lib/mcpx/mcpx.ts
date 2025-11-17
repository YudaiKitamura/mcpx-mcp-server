import koffi, { KoffiFunction } from 'koffi';
import { DataType, Prefix, RequestFrame } from './type.d';

type ResultTypeMap = {
  [DataType.Short]: number;
  [DataType.Int]: number;
  [DataType.Float]: number;
  [DataType.Bool]: boolean;
}

const Device = koffi.struct('Device', {
  Prefix: 'uint8',
  Address: 'char*',
});

export class McpX 
{
  private conectionId: number;

  private plc_connect: KoffiFunction;
  private plc_close: KoffiFunction;

  private batch_read_short: KoffiFunction;
  private batch_read_int: KoffiFunction;
  private batch_read_float: KoffiFunction;
  private batch_read_bool: KoffiFunction;

  private batch_write_short: KoffiFunction;
  private batch_write_int: KoffiFunction;
  private batch_write_float: KoffiFunction;
  private batch_write_bool: KoffiFunction;

  constructor(
    ip: string,
    port: number,
    password: string | undefined = undefined,
    isAscii: boolean = false,
    isUdp: boolean = false,
    requestFrame: RequestFrame = RequestFrame.E3
  )
  {
    const lib = koffi.load('src/bin/McpXInterop-linux-x64.so');
    this.plc_connect = lib.func('plc_connect', 'int', ['char*', 'int', 'char*', 'bool', 'bool', 'int']);
    this.plc_close = lib.func('plc_close', 'void', ['int']);

    this.batch_read_short = lib.func('batch_read_short', 'int', ['int', 'short*', Device, 'int']);
    this.batch_read_int = lib.func('batch_read_int', 'int', ['int', 'int*', Device, 'int']);
    this.batch_read_float = lib.func('batch_read_float', 'int', ['int', 'float*', Device, 'int']);
    this.batch_read_bool = lib.func('batch_read_bool', 'int', ['int', 'bool*', Device, 'int']);

    this.batch_write_short = lib.func('batch_write_short', 'int', ['int', 'short*', Device, 'int']);
    this.batch_write_int = lib.func('batch_write_int', 'int', ['int', 'int*', Device, 'int']);
    this.batch_write_float = lib.func('batch_write_float', 'int', ['int', 'float*', Device, 'int']);
    this.batch_write_bool = lib.func('batch_write_bool', 'int', ['int', 'bool*', Device, 'int']);

    this.conectionId = this.plc_connect(this.toCString(ip), port, password ? this.toCString(password) : undefined, isAscii, isUdp, requestFrame);
    if (this.conectionId < 0) throw new Error(`Failed to connect to PLC.`);
  }

  public dispose()
  {
    this.plc_close(this.conectionId);
  }

  private createDevice(prefix: Prefix, address: string) {
    return {
      Prefix: prefix,
      Address: this.toCString(address),
    };
  }

  private toCString(str: string): Buffer {
    return Buffer.from(str + '\0', 'ascii');
  }
  
  public batchRead<T extends DataType>(
    type: T,
    address: string,
    length: number
  ): ResultTypeMap[T][]
  {
    const d = this.parseDevice(address);
    const device = this.createDevice(d.prefix, d.address);
    let out: any;
    let code: number;

    switch (type) {
      case DataType.Short:
        out = koffi.alloc('short', length);
        code = this.batch_read_short(this.conectionId, out, device, length);
        break;
      case DataType.Int:
        out = koffi.alloc('int', length);
        code = this.batch_read_int(this.conectionId, out, device, length);
        break;
      case DataType.Float:
        out = koffi.alloc('float', length);
        code = this.batch_read_float(this.conectionId, out, device, length);
        break;
      case DataType.Bool:
        out = koffi.alloc('bool', length);
        code = this.batch_read_bool(this.conectionId, out, device, length);
        break;
      default:
        throw new Error(`Unsupported DataType: ${type}`);
    }

    if (code !== 0) throw new Error(`batchRead(${type}) failed: ${code}`);
    return koffi.decode(out, type, length) as ResultTypeMap[T][];
  }

  public batchWrite<T extends DataType>(
    type: T,
    address: string,
    values: ResultTypeMap[T][]
  ): void {
    const d = this.parseDevice(address);
    const device = this.createDevice(d.prefix, d.address);

    switch (type) {
      case DataType.Short: {
        const buffer = Int16Array.from(values as number[]);
        const code = this.batch_write_short(this.conectionId, buffer, device, buffer.length);
        if (code !== 0) throw new Error(`writeShorts failed: ${code}`);
        break;
      }
      case DataType.Int: {
        const buffer = Int32Array.from(values as number[]);
        const code = this.batch_write_int(this.conectionId, buffer, device, buffer.length);
        if (code !== 0) throw new Error(`writeInts failed: ${code}`);
        break;
      }
      case DataType.Float: {
        const buffer = Float32Array.from(values as number[]);
        const code = this.batch_write_float(this.conectionId, buffer, device, buffer.length);
        if (code !== 0) throw new Error(`writeFloats failed: ${code}`);
        break;
      }
      case DataType.Bool: {
        const code = this.batch_write_bool(this.conectionId, values as boolean[], device, values.length);
        if (code !== 0) throw new Error(`writeBools failed: ${code}`);
        break;
      }
      default:
        throw new Error(`Unsupported DataType: ${type}`);
    }
  }

  private parseDevice(device: string) 
  {
    const match = device.match(/^([A-Za-z]+)([0-9A-F]+)$/i);
    if (!match) throw new Error(`Invalid device: ${device}`);

    const [, prefixStr, addrStr] = match;

    if (!(prefixStr.toUpperCase() in Prefix))
    {
      throw new Error(`Unknown prefix: ${prefixStr}`);
    }

    return {
      prefix: Prefix[prefixStr.toUpperCase() as keyof typeof Prefix],
      address: addrStr
    };
  }
}
