This folder contains font assets that are served by the Manager web app at runtime under the URL path /shared/fonts.

Custom fonts used by the UI:
- B Nazanin (UI text)
- B Titr (Titles/headings)

Place the licensed font files into the following directories (replace the placeholder files with the actual fonts):
- B Nazanin/BNazanin.woff2
- B Nazanin/BNazanin.woff
- B Nazanin/BNazanin.ttf
- B Titr/BTitr.woff2
- B Titr/BTitr.woff
- B Titr/BTitr.ttf

The HTML entry points reference these files via @font-face using absolute URLs like /shared/fonts/B Nazanin/BNazanin.woff2.

Note: The repository only contains empty placeholder files because we cannot commit proprietary font files. Replace them with your licensed versions during deployment.
