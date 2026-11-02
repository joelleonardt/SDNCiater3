import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GradeComponent } from '@/services/gradeService'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  classId: string
  semesterId: string
  components: GradeComponent[]
  saving: boolean
  onSave: (components: { name: string; weight: number }[]) => void
}

// ─── Form types ───────────────────────────────────────────────────────────────

const componentSchema = z.object({
  components: z.array(
    z.object({
      name: z.string().min(1, 'Nama komponen wajib diisi').max(50, 'Maksimal 50 karakter'),
      weight: z.coerce
        .number({ invalid_type_error: 'Bobot wajib diisi' })
        .min(1, 'Minimal 1')
        .max(100, 'Maksimal 100'),
    }),
  ),
})

type FormValues = z.infer<typeof componentSchema>

/**
 * Konfigurasi komponen nilai: daftar nama + bobot yang bisa ditambah/hapus.
 * Requirements: 18.2
 */
export default function GradeComponentsConfig({
  components,
  saving,
  onSave,
}: Props) {
  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(componentSchema),
    defaultValues: { components: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'components' })

  // Sync form saat prop components berubah (setelah save atau load)
  useEffect(() => {
    reset({
      components: components.map((c) => ({ name: c.name, weight: c.weight })),
    })
  }, [components, reset])

  const watched = watch('components')
  const totalWeight = watched.reduce((acc, c) => acc + (Number(c.weight) || 0), 0)
  const weightOk = totalWeight === 100

  function onSubmit(values: FormValues) {
    onSave(values.components.map((c) => ({ name: c.name, weight: Number(c.weight) })))
  }

  return (
    <section className="rounded-lg border p-4 space-y-4">
      <h2 className="text-base font-semibold">Komponen Nilai</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Header */}
        {fields.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
            <span className="flex-1">Nama Komponen</span>
            <span className="w-24 text-center">Bobot (%)</span>
            <span className="w-8" />
          </div>
        )}

        {/* Baris komponen */}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`comp-name-${index}`} className="sr-only">
                Nama komponen {index + 1}
              </Label>
              <Input
                id={`comp-name-${index}`}
                placeholder="Contoh: UTS"
                aria-invalid={Boolean(errors.components?.[index]?.name)}
                aria-describedby={errors.components?.[index]?.name ? `comp-name-${index}-error` : undefined}
                {...register(`components.${index}.name`)}
              />
              {errors.components?.[index]?.name && (
                <p id={`comp-name-${index}-error`} role="alert" className="text-xs text-destructive">
                  {errors.components[index]?.name?.message}
                </p>
              )}
            </div>
            <div className="w-24 space-y-1">
              <Label htmlFor={`comp-weight-${index}`} className="sr-only">
                Bobot komponen {index + 1}
              </Label>
              <Input
                id={`comp-weight-${index}`}
                type="number"
                min={0}
                max={100}
                placeholder="0"
                aria-invalid={Boolean(errors.components?.[index]?.weight)}
                aria-describedby={errors.components?.[index]?.weight ? `comp-weight-${index}-error` : undefined}
                {...register(`components.${index}.weight`, { valueAsNumber: true })}
              />
              {errors.components?.[index]?.weight && (
                <p id={`comp-weight-${index}-error`} role="alert" className="text-xs text-destructive">
                  {errors.components[index]?.weight?.message}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Hapus komponen ${index + 1}`}
              onClick={() => remove(index)}
              className="w-8 h-8 mt-1 shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}

        {/* Total bobot */}
        {fields.length > 0 && (
          <p className={`text-sm px-1 ${weightOk ? 'text-muted-foreground' : 'text-destructive font-medium'}`}>
            Total bobot: {totalWeight}%
            {!weightOk && ' — harus tepat 100%'}
          </p>
        )}

        {/* Tombol aksi */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: '', weight: 0 })}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Tambah Komponen
          </Button>
          {fields.length > 0 && (
            <Button
              type="submit"
              size="sm"
              disabled={saving || !weightOk}
              aria-busy={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Menyimpan…' : 'Simpan Komponen'}
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
