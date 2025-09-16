// src/app/login/page.js
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <LoginForm />
      </div>
    </div>
  );
}