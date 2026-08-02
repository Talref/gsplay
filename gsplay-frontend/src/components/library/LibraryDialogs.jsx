import { Button, Stack, Typography } from '@mui/material'
import ThemedDialog from '../ThemedDialog'

function SteamHelp() {
  return (
    <>
      <Typography>Per Trovare il tuo steamID:</Typography>
      <ol>
        <li>Visita il tuo profilo Steam (log in se necessario)</li>
        <li>Il tuo SteamID sono le ultime 17 cifre dell’URL</li>
        <li>
          Se il tuo profilo steam non finisce con lo SteamID visita SteamID.io ed incolla il link
          del tuo profilo
        </li>
        <li>
          SteamID.io calcolera&apos; il tuo SteamID dal link (quello corretto e&apos; SteamID64).
        </li>
        <li>Inserisci il tuo SteamID nel form di questa pagina</li>
        <li>
          ATTENZIONE: La tua lista di giochi dev&apos;essere PUBBLICA sul tuo profilo Steam!
          Altrimenti l&apos;app non puo&apos; leggerla!
        </li>
      </ol>
      <Typography>
        Non c&apos;e&apos; bisogno di ripetere questa operazione. Se aggiungete nuovi giochi alla
        vostra libreria basta cliccare su Aggiorna Libreria.
      </Typography>
    </>
  )
}

function ImportHelp() {
  return (
    <>
      <ol>
        <li>Installa Heroic Games Launcher</li>
        <li>Collega i tuoi account e popola la tua libreria</li>
        <li>
          Apri: C:\Users\NOME_UTENTE\AppData\Roaming\heroic\store_cache (Windows) o:
          ~/.config/heroic/store_cache/ (Linux) (attenzione, i percorsi derivano da test, se avete i
          file in un altra posizione pingatemi sul server - @eradan)
        </li>
        <li>
          Carica i file rilevanti che finiscono in &quot;library&quot; cliccando su &quot;Importa
          GOG/Epic&quot; (gog_library.json per GOG, legendary_library.json per Epic e
          nile_library.json per Amazon Games)
        </li>
      </ol>
      <Typography>
        Fatto! Ricorda di ricaricare i file ogni tanto se aggiungi nuovi giochi!
      </Typography>
    </>
  )
}

export default function LibraryDialogs({ help, onCloseHelp, removeItem, onCloseRemove, onRemove }) {
  return (
    <>
      <ThemedDialog open={help === 'steam'} onClose={onCloseHelp} title="Come trovare lo SteamID">
        <SteamHelp />
      </ThemedDialog>
      <ThemedDialog
        open={help === 'import'}
        onClose={onCloseHelp}
        title="Come importare giochi da GOG/Epic/Amazon Games"
      >
        <ImportHelp />
      </ThemedDialog>
      <ThemedDialog
        open={Boolean(removeItem)}
        onClose={onCloseRemove}
        title="Leva dalla libbreria?"
      >
        <Stack spacing={2}>
          <Typography>
            Rimuoverò solo l’aggiunta manuale di <strong>{removeItem?.canonicalGame?.title}</strong>
            .
          </Typography>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={onCloseRemove}>Annulla</Button>
            <Button color="error" variant="contained" onClick={onRemove}>
              Sì, rimuovi
            </Button>
          </Stack>
        </Stack>
      </ThemedDialog>
    </>
  )
}
