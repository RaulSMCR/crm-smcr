export default function ColorPaletteGuide() {
  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-bold text-center text-brand-dark mb-6">Guía de Estilo: Paleta de Colores</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="rounded-lg shadow-md p-4 bg-brand-primary text-white">
          <h3 className="font-bold text-lg">Primary</h3>
          <p>#58BDAB</p>
        </div>

        <div className="rounded-lg shadow-md p-4 bg-brand-background text-brand-dark border">
          <h3 className="font-bold text-lg">Background</h3>
          <p>#F5F3F0</p>
        </div>

        <div className="rounded-lg shadow-md p-4 bg-brand-accent text-white">
          <h3 className="font-bold text-lg">Accent</h3>
          <p>#F4A261</p>
        </div>

        <div className="rounded-lg shadow-md p-4 bg-brand-dark text-white">
          <h3 className="font-bold text-lg">Dark / Text</h3>
          <p>#2D2D2D</p>
        </div>

      </div>
    </div>
  );
}