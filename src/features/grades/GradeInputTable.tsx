import * as React from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import SkeletonTable from '@/components/ui/SkeletonTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatNumber, cn, scoreToLetter } from '@/lib/utils'
import { calculateWeightedAverage, type GradeComponent, type GradeRow } from '@/services/gradeService'
import type { GradeScale } from '@/types/database.types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  components: GradeComponent[]
  gradeRows: GradeRow[]
  gradeScales?: GradeScale[]
  loading: boolean
  saving: boolean
  readOnly?: boolean
  onUpdateScore: (studentId: string, componentId: string, score: number) => void
  onSave: () => void
}

/**
 * Tabel input nilai siswa: baris = siswa, kolom = komponen + nilai akhir + huruf nilai,
 * disertai ringkasan statistik kelas (Rata-rata, Tertinggi, Terendah).
 * Requirements: 10.3–10.9
 */
export default function GradeInputTable({
  components,
  gradeRows,
  gradeScales = [],
  loading,
  saving,
  readOnly = false,
  onUpdateScore,
  onSave,
}: Props) {
  const [scoreError, setScoreError] = React.useState<string | null>(null)

  if (loading) {
    return <SkeletonTable isLoading columns={components.length + 3} rows={5} />
  }

  if (components.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Tambahkan komponen nilai terlebih dahulu.
      </p>
    )
  }

  const totalWeight = components.reduce((acc, c) => acc + c.weight, 0)
  const weightValid = totalWeight === 100

  if (gradeRows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Belum ada siswa terdaftar di kelas ini.
      </p>
    )
  }

  // Hitung nilai akhir per siswa (dibulatkan 2 desimal, Req 10.5)
  const finalScores = gradeRows.map((row) => {
    const hasAnyScore = Object.keys(row.grades).length > 0
    if (!hasAnyScore) return null
    const raw = calculateWeightedAverage(row.grades, components)
    return Math.round(raw * 100) / 100
  })

  const validFinalScores = finalScores.filter((s): s is number => s !== null)
  const classStats =
    validFinalScores.length > 0
      ? {
          avg:
            Math.round(
              (validFinalScores.reduce((a, b) => a + b, 0) / validFinalScores.length) * 100
            ) / 100,
          max: Math.max(...validFinalScores),
          min: Math.min(...validFinalScores),
        }
      : null

  return (
    <div className="space-y-4">
      {/* Peringatan bila total bobot != 100 (Req 10.3) */}
      {!weightValid && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Total bobot komponen nilai saat ini adalah {totalWeight}%. Formulir input nilai
            dinonaktifkan hingga total bobot komponen nilai tepat 100%.
          </span>
        </div>
      )}

      {/* Peringatan bila Skala_Nilai belum dikonfigurasi (Req 10.7) */}
      {gradeScales.length === 0 && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-xs text-yellow-800"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Skala nilai belum dikonfigurasi di Pengaturan. Huruf nilai ditampilkan sebagai N/A.
          </span>
        </div>
      )}

      {scoreError && (
        <p role="alert" className="text-xs text-destructive">
          {scoreError}
        </p>
      )}

      {/* Statistik kelas (Req 10.8) */}
      {classStats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Rata-rata Kelas</p>
            <p className="text-lg font-semibold tabular-nums">{formatNumber(classStats.avg, 2)}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Nilai Tertinggi</p>
            <p className="text-lg font-semibold tabular-nums text-green-700">
              {formatNumber(classStats.max, 2)}
            </p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Nilai Terendah</p>
            <p className="text-lg font-semibold tabular-nums text-amber-700">
              {formatNumber(classStats.min, 2)}
            </p>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 text-center font-semibold min-w-[80px]">
                  Predikat
                </th>
              </tr>
            </thead>
            <tbody>
              {gradeRows.map((row, idx) => {
                const finalScore = finalScores[idx]
                const letter =
                  finalScore !== null ? scoreToLetter(finalScore, gradeScales) : '—'
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
                          disabled={readOnly || !weightValid}
                          className="h-8 w-20 text-center mx-auto"
                          value={row.grades[comp.id] ?? ''}
                          onChange={(e) => {
                            const rawVal = e.target.value
                            if (rawVal === '') return
                            const val = Number(rawVal)
                            if (isNaN(val) || val < 0 || val > 100) {
                              setScoreError('Nilai harus berupa angka antara 0 dan 100.')
                              return
                            }
                            setScoreError(null)
                            onUpdateScore(row.student_id, comp.id, val)
                          }}
                          aria-label={`Nilai ${comp.name} untuk ${row.full_name}`}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center font-semibold tabular-nums">
                      {finalScore !== null ? formatNumber(finalScore, 2) : '—'}
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">
                      {letter}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="flex justify-end p-4 border-t">
            <Button onClick={onSave} disabled={saving || !weightValid} aria-busy={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Menyimpan…' : 'Simpan Semua Nilai'}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
