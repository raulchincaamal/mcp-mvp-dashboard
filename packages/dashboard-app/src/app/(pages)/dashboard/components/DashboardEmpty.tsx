'use client';

import { Card, Text, Button } from '@macropaytd/lib-front-ui-components';

interface DashboardEmptyProps {
  type: 'no-key' | 'expired' | 'error';
}

const content = {
  'no-key': {
    icon: '📊',
    title: 'No hay dashboard seleccionado',
    description:
      'Para visualizar un dashboard, genera uno desde Kiro con un comando como:',
    example:
      '"Genera un dashboard ejecutivo de ventas del Q4 2024 agrupado por estado"',
    hint: 'Recibirás una URL con la clave del dashboard generado.',
  },
  expired: {
    icon: '⏱️',
    title: 'Dashboard expirado',
    description:
      'La clave proporcionada ya no existe en cache. Los dashboards tienen un tiempo de vida limitado.',
    example: null,
    hint: 'Genera un nuevo dashboard desde Kiro para obtener una URL actualizada.',
  },
  error: {
    icon: '⚠️',
    title: 'No se pudo cargar el dashboard',
    description:
      'Hubo un problema al conectar con el servicio de cache. Verifica que Redis esté disponible.',
    example: null,
    hint: 'Si el problema persiste, contacta al administrador del sistema.',
  },
};

export default function DashboardEmpty({ type }: DashboardEmptyProps) {
  const { icon, title, description, example, hint } = content[type];

  return (
    <main className="flex items-center justify-center min-h-[80vh] p-6">
      <Card className="max-w-lg w-full p-8 space-y-6 text-center">
        <div className="text-5xl">{icon}</div>

        <div className="space-y-2">
          <Text size="xl" weight="bold">
            {title}
          </Text>
          <Text size="sm" className="text-muted-foreground">
            {description}
          </Text>
        </div>

        {example && (
          <div className="bg-muted/50 rounded-lg p-4 text-left">
            <Text size="xs" className="text-muted-foreground mb-1 block">
              Ejemplo de prompt:
            </Text>
            <Text size="sm" weight="bold" className="italic">
              {example}
            </Text>
          </div>
        )}

        <div className="border-t pt-4">
          <Text size="xs" className="text-muted-foreground">
            {hint}
          </Text>
        </div>

        {type !== 'no-key' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
          >
            ← Volver
          </Button>
        )}
      </Card>
    </main>
  );
}
