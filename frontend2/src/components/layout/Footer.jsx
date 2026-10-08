import Logo from "./Logo";
export default function Footer() {
  return (
    <footer className="container site-footer flex flex-col sm:flex-row items-center justify-between gap-5">
      <Logo />
      <p>© {new Date().getFullYear()} Clique Salon. All rights reserved.</p>
      <a href="mailto:cliquecustomersupport@gmail.com">Get in touch ↗</a>
    </footer>
  );
}
