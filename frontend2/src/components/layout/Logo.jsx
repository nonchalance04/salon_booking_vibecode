import { Link } from "react-router-dom";
export default function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Clique Salon and Spa home">
      <span>CLIQUE</span>
      <small>salon and spa</small>
    </Link>
  );
}
