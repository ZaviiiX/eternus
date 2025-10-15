import { Link } from "react-router-dom";

export default function SportCard({ sport }) {
  return (
    <Link
      to={`/sport/${sport.id}`}
      className="bg-[#18181B] rounded-xl shadow hover:shadow-lg hover:border-[#bff47b] border border-transparent transition p-6 flex flex-col items-center justify-center text-center text-[#FFFFFF] font-[Inter,sans-serif]"
    >
      <div className="text-5xl mb-4">{sport.icon}</div>
      <h3 className="font-semibold text-lg text-[#A1A1AA]">{sport.name}</h3>
    </Link>
  );
}
