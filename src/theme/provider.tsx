"use client";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import tokens from "./krug-tokens.json";
const c = tokens.colors;
const theme = createTheme({
  palette: { primary: { main: c.primary, contrastText: c.onPrimary }, secondary: { main: c.tertiary }, error: { main: c.error }, background: { default: c.surface, paper: c.surfaceContainerLowest }, text: { primary: c.onSurface, secondary: c.onSurfaceVariant }, divider: c.outlineVariant },
  typography: { fontFamily: tokens.typography.fontFamily, button: { textTransform: "none", fontWeight: 600, fontSize: 14 } },
  shape: { borderRadius: tokens.shape.large }, spacing: tokens.spacing.unit,
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: tokens.shape.full, minHeight: 48, padding: "10px 24px" } } },
    MuiTextField: { defaultProps: { fullWidth: true, variant: "outlined" } },
    MuiOutlinedInput: { styleOverrides: { root: { background: c.surfaceContainerLowest, borderRadius: tokens.shape.medium, fontSize: 16 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 10, fontWeight: 500 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 28, padding: 8 } } },
  },
});
export function KrugTheme({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}><div className="krug-theme" style={Object.fromEntries(Object.entries(c).map(([key, value]) => [`--krug-${key}`, value])) as React.CSSProperties}>{children}</div></ThemeProvider>;
}
