import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Search, Menu, X } from "lucide-react";
import Logo from "./Logo";
export default function Header() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <header className="site-header">
      <div className="container flex items-center justify-between gap-8">
        <Logo />
        <nav
          className={`${open ? "nav-open" : ""} main-nav flex items-center gap-10`}
          aria-label="Main navigation"
        >
          <NavLink to="/" end onClick={() => setOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/services" onClick={() => setOpen(false)}>
            Services
          </NavLink>
          <NavLink to="/about" onClick={() => setOpen(false)}>
            About Us
          </NavLink>
        </nav>
        <form
          className="search-box hidden lg:flex items-center gap-2"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/services?q=${encodeURIComponent(query)}`);
          }}
        >
          <Search size={17} />
          <input
            aria-label="Search services"
            placeholder="Searching for something?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <button
          className="icon-button mobile-menu"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
