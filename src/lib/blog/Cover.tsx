// A post's thumbnail on /blog and under "More from the blog": the post's share image (/og/blog/<slug>). From the registry alone: the
// index reads no data.
import type { Post } from "./index";

export function PostCover({ post, index, eager = false }: { post: Post; index: number; eager?: boolean }) {
  void index;
  const loading = eager ? "eager" : "lazy";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/og/blog/${post.slug}`}
      alt={post.title}
      width={1200}
      height={630}
      loading={loading}
      decoding="async"
      className="aspect-[1200/630] h-auto w-full bg-raised object-cover"
    />
  );
}
