export default function Footer() {
  return (
    <footer className="border-t border-[#1F1F23] bg-[#18181B]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-[#666]">
          © {new Date().getFullYear()} Udruga Eternus. Sva prava pridržana.
        </p>
        <div className="flex items-center gap-4 text-xs text-[#666]">
          <a href="#" className="hover:text-[#00E0FF] transition-colors">Pomoć</a>
          <span>•</span>
          <a href="#" className="hover:text-[#00E0FF] transition-colors">Kontakt</a>
          <span>•</span>
          <a href="#" className="hover:text-[#00E0FF] transition-colors">Pravila</a>
        </div>
      </div>
    </footer>
  );
}
