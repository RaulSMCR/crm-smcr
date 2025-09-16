// src/app/blog/page.js
import BlogPostCard from "@/components/BlogPostCard";
import { posts } from "@/data/mockData"; // Import data from our central file

export default function BlogPage() {
  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">
          Nuestro Blog
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <BlogPostCard key={post.title} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}