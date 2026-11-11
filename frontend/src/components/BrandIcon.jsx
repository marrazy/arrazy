// Brand logos, drawn in one colour (the text colour unless `color` is given).
// `icon` is either a simple-icons icon (https://simpleicons.org), e.g. `import { siPython } from 'simple-icons'`,
// or one from ../logos.js, which may also set `viewBox`, `fillRule`, several paths, or a `mask` image.
export function BrandIcon({ icon, size = 16, color = 'currentColor' }) {
  if (icon.mask) {
    // An image used as a stencil, so it takes the colour like the SVG logos do
    const mask = `url(${icon.mask}) center / contain no-repeat`
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          flex: 'none',
          width: size,
          height: size,
          backgroundColor: color,
          mask,
          WebkitMask: mask,
        }}
      />
    )
  }

  const paths = Array.isArray(icon.path) ? icon.path : [icon.path]
  return (
    <svg width={size} height={size} viewBox={icon.viewBox ?? '0 0 24 24'} fill={color} aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} fillRule={icon.fillRule} clipRule={icon.fillRule} />
      ))}
    </svg>
  )
}
