import { Loader2 } from 'lucide-react'
import SkeletonTable from '@/components/ui/SkeletonTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatNumber, cn } from '@/lib/utils'
import { calculateWeightedAverage, type GradeComponent, type GradeRow } from '@/services/gradeService'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  components: GradeComponent[]
  gradeRows: GradeRow[]
  loading: boolean
  saving: boolean
  onUpdateScore: (studentId: string, componentId: string, score: number) => void
  onSave: () => void
}

/**
 * Tabel input nilai siswa: baris = siswa, kolom = komponen + nilai akhir.
 * Requirements: 18.2
 */
export default function GradeInputTable({
  components,
  gradeRows,
  loading,
  saving,
  onUpdateScore,
  onSave,
}: Props) {
  if (loading) {
    return <SkeletonTable isLoading columns={components.length + 2} rows={5} />
  }

  if (components.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Tambahkan komponen nilai terlebih dahulu.
      </p>
    )
  }

  if (gradeRows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Belum ada siswa terdaftar di kelas ini.
      </p>
    )
  }

  return (
    <section className="rounded-lg border space-y-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8">#</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground min-w-[160px]">
                Nama Siswa
              </th>
              {components.map((comp) => (
                <th
                  key={comp.id}
                  className="px-4 py-3 text-center font-medium text-muted-foreground min-w-[96px]"
                >
                  <div>{comp.name}</div>
                  <div className="text-xs font-normal text-muted-foreground/70">
                    Bobot {comp.weight}%
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-center font-semibold min-w-[96px]">
                Nilai Akhir
              </th>
            </tr>
          </thead>
          <tbody>
            {gradeRows.map((row, idx) => {
              const finalScore = calculateWeightedAverage(row.grades, components)
              return (
                <tr
                  key={row.student_id}
                  className={cn('border-b last:border-0', idx % 2 === 1 && 'bg-muted/20')}
                >
                  <td className="px-4 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium">{row.full_name}</td>
                  {components.map((comp) => (
                    <td key={comp.id} className="px-2 py-1.5 text-center">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-8 w-20 text-center mx-auto"
                        value={row.grades[comp.id] ?? ''}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (!isNaN(val)) {
                            onUpdateScore(row.student_id, comp.id, val)
                          }
                        }}
                        aria-label={`Nilai ${comp.name} untuk ${row.full_name}`}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-center font-semibold tabular-nums">
                    {finalScore > 0 ? formatNumber(Math.round(finalScore * 10) / 10) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end p-4 border-t">
        <Button onClick={onSave} disabled={saving} aria-busy={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Menyimpan…' : 'Simpan Semua Nilai'}
        </Button>
      </div>
    </section>
  )
}
