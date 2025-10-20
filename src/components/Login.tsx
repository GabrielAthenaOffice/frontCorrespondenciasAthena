import React, { useState } from "react";
import { API_BASE } from "../service/api";
import { useNavigate } from "react-router-dom";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const navigate = useNavigate(); // ✅ Mover pra cá!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      if (!resp.ok) {
        throw new Error("Credenciais inválidas");
      }

      // login bem-sucedido → redireciona
      navigate("/dashboard"); // ✅ Agora funciona sem erro

    } catch (err: any) {
      setErro(err.message || "Falha no login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1f242b]">
      <div className="bg-[#23272f] p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Acesso Athena
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              E-mail
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-lg bg-[#1f242b] border border-gray-700 text-white focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Senha
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg bg-[#1f242b] border border-gray-700 text-white focus:ring-2 focus:ring-blue-500"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
