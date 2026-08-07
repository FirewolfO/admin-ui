import type { Department } from '@permission/types'

export function buildDepartmentTree(departments: Department[]): Department[] {
  const nodes = new Map(departments.map((department) => [department.id, { ...department, children: [] as Department[] }]))
  const roots: Department[] = []

  nodes.forEach((department) => {
    const parent = department.parentId ? nodes.get(department.parentId) : undefined
    if (parent) parent.children?.push(department)
    else roots.push(department)
  })

  return roots
}
