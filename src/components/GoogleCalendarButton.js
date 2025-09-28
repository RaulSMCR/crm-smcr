import Link from 'next/link';

const GoogleCalendarButton = ({ professional }) => {
  return (
    <Link
      href={`/perfil/${professional.id}/calendar`}
      className="bg-brand-primary text-white font-bold px-8 py-3 rounded-md text-lg hover:bg-opacity-90"
    >
      Agendar Cita con este Profesional
    </Link>
  );
};

export default GoogleCalendarButton;