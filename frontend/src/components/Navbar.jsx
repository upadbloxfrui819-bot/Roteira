import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";
import { Sparkle, SignOut, User as UserIcon } from "@phosphor-icons/react";

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      data-testid="site-navbar"
      className="sticky top-0 z-50 bg-zinc-950/70 backdrop-blur-xl border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
          <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkle weight="fill" size={18} className="text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-bold tracking-tighter">Roteira</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <Link to="/pricing" className="hover:text-white transition-colors duration-200" data-testid="nav-pricing">Preços</Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="text-white hover:text-primary" data-testid="nav-dashboard">
                  <UserIcon size={16} weight="duotone" className="mr-2" /> {user.name?.split(" ")[0] || "Conta"}
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/"); }} data-testid="nav-logout"
                className="border-white/10 text-white hover:bg-white/5">
                <SignOut size={16} className="mr-1" /> Sair
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login">
                <Button variant="ghost" size="sm" className="text-white hover:text-primary">Entrar</Button>
              </Link>
              <Link to="/login" data-testid="nav-cta">
                <Button size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-primary">
                  Criar meu roteiro
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
