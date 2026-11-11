declare module "heic-convert" {
  type ConvertOptions = {
    buffer: Buffer | ArrayBufferView;
    format: "JPEG" | "PNG";
    quality?: number;
  };
  function convert(options: ConvertOptions): Promise<ArrayBuffer>;
  export default convert;
}
