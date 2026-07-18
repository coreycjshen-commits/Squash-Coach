import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`glass rounded-2xl p-5 ${className}`}
      {...rest}
    />
  )
}
