import type { ImgHTMLAttributes } from "react";

export default function PreviewImage({ unoptimized, ...props }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
  return <img {...props} />;
}
