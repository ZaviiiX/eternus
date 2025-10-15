import { useEffect, useState } from "react";
import { supabase, getRecentMatches } from "../services/api";
import {
  BarChart2,
  TrendingUp,
  Clock,
  Trophy,
  Calendar,
  ChevronRight,
  Flame,
  Pause,
  CheckCircle2,
  Menu,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

/* ============ ⏱ helperi ============ */
function computeElapsedSeconds(m) {
  let elapsed = Number(m.elapsed_seconds ?? 0);
  if (m.is_running && m.last_started_at) {
    const delta = Math.floor(
      (Date.now() - new Date(m.last_started_at).getTime()) / 1000
    );
    elapsed += delta;
  }
  return Math.max(0, elapsed);
}
function computeRemainingSeconds(m) {
  const duration = Number(m.duration_seconds ?? 600);
  return Math.max(0, duration - computeElapsedSeconds(m));
}
function mmss(sec) {
  const s = Math.max(0, sec | 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Render a small emoji or icon for a sport name. Returns an element (string is fine
// for emoji). Keep accessibility in mind: the caller wraps this in a span with
// appropriate visual sizing; use emoji + invisible label where helpful.
function renderSportIcon(name) {
  if (!name) return "🎯";
  const key = name.toLowerCase();
  if (
    key.includes("football") ||
    key.includes("nogomet") ||
    key.includes("soccer")
  ) {
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="m2.782 11.225l.396-.262c.594-.393.987-.654 1.265-.887c.264-.221.364-.369.416-.507c.052-.138.076-.315.025-.656c-.054-.36-.175-.815-.359-1.504l-.167-.625a9.205 9.205 0 0 0-1.576 4.44Zm2.75-5.84a.76.76 0 0 1 .024.074l.429 1.602c.17.638.315 1.177.382 1.631c.035.233.053.46.042.687l2.5 1.053a1.75 1.75 0 0 1 .18-.16l1.838-1.404c.098-.075.203-.139.312-.19v-2.71a3.527 3.527 0 0 1-.608-.284c-.398-.229-.847-.56-1.377-.952L7.876 3.715a9.263 9.263 0 0 0-2.344 1.67Zm4.007-2.306l.572.422c.573.423.953.702 1.268.883c.298.171.47.214.618.216c.147.001.32-.038.622-.203c.318-.174.704-.445 1.286-.855l.622-.438a9.233 9.233 0 0 0-2.538-.354a9.21 9.21 0 0 0-2.45.329Zm6.646.678a.756.756 0 0 1-.095.08l-1.354.954c-.54.38-.995.702-1.397.922c-.197.108-.396.2-.6.267v2.697c.108.052.213.116.311.191l1.837 1.405c.066.05.127.104.184.162l2.56-1.06c-.01-.225.008-.451.043-.683c.067-.454.212-.993.382-1.63l.429-1.602a.653.653 0 0 1 .008-.029a9.266 9.266 0 0 0-2.308-1.674Zm3.48 3.095l-.149.557c-.184.689-.305 1.145-.359 1.504c-.05.34-.027.518.025.656c.052.138.152.286.416.507c.278.233.67.494 1.265.887l.328.217a9.203 9.203 0 0 0-1.526-4.328Zm3.055 5.55c.004-.133.007-.267.007-.402c0-5.936-4.807-10.75-10.739-10.75C6.058 1.25 1.25 6.064 1.25 12s4.807 10.75 10.739 10.75c5.625 0 10.238-4.33 10.7-9.84a.749.749 0 0 0 .03-.508Zm-1.543.567L20 12.19c-.55-.363-1.016-.67-1.367-.966a3.56 3.56 0 0 1-.458-.452l-2.613 1.082a1.75 1.75 0 0 1-.067.324l-.721 2.337c-.026.082-.056.16-.092.236l1.468 1.698c.225-.075.46-.12.704-.148c.456-.052 1.014-.052 1.673-.052h1.668a9.17 9.17 0 0 0 .98-3.281Zm-1.951 4.781h-.656c-.713 0-1.184.001-1.544.042c-.341.04-.506.107-.625.194c-.12.086-.237.22-.382.533c-.153.33-.303.777-.528 1.453l-.226.68a9.263 9.263 0 0 0 3.96-2.902Zm-5.7 3.372l.555-1.663c.208-.627.385-1.156.578-1.572c.087-.188.183-.364.295-.528l-1.434-1.66a1.693 1.693 0 0 1-.416.051h-2.23c-.133 0-.263-.015-.388-.043L9.21 17.332c.12.171.222.357.313.555c.194.416.37.945.579 1.572l.565 1.697a9.294 9.294 0 0 0 2.86-.034Zm-4.58-.385l-.254-.765c-.226-.676-.376-1.124-.529-1.453c-.145-.312-.262-.447-.381-.533c-.12-.087-.284-.155-.625-.194c-.36-.04-.832-.042-1.544-.042H4.75a9.258 9.258 0 0 0 4.195 2.987Zm-5.15-4.46a.752.752 0 0 1 .202-.027h1.656c.66 0 1.217 0 1.673.052c.235.027.46.069.676.139l1.304-1.662a1.754 1.754 0 0 1-.105-.263l-.721-2.337a1.75 1.75 0 0 1-.068-.328l-2.55-1.075a3.58 3.58 0 0 1-.456.45c-.352.294-.817.601-1.367.965l-1.236.817c.127 1.17.47 2.273.991 3.27Zm8.192-6.269a.247.247 0 0 0-.15.052L10 11.463a.249.249 0 0 0-.087.273l.722 2.337a.248.248 0 0 0 .237.176h2.23a.246.246 0 0 0 .238-.176l.722-2.337a.25.25 0 0 0-.087-.273l-1.837-1.405a.246.246 0 0 0-.15-.05Z"
            clip-rule="evenodd"
          />
        </svg>
      </span>
    );
  }
  if (
    key.includes("tennis") ||
    key.includes("stolni") ||
    key.includes("table tennis")
  )
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 32 32"
          role="img"
          aria-label="tennis"
          className="block"
        >
          <title>Tennis</title>
          <path
            fill="currentColor"
            d="M7 4C5.355 4 4 5.355 4 7s1.355 3 3 3s3-1.355 3-3s-1.355-3-3-3zm11.938.906A9.365 9.365 0 0 0 18 4.97c-2.469.289-4.773 1.554-6.531 3.312c-1.235 1.23-2.258 3-2.594 6.281a.88.88 0 0 0-.031.094v.031a1.072 1.072 0 0 0-.063.157c-.004.023.004.035 0 .062v.125a1.117 1.117 0 0 0 .094.375c.05.899.176 1.817.5 2.688h-.031c.015.086.117.515.125.937c.004.317-.11.606-.125.688c-.61.605-1.34 1.238-2.031 1.781c-.692.543-1.29 1.012-1.72 1.438h-.03A2.33 2.33 0 0 0 4.968 25c.152.7.554 1.305 1.093 1.844c.536.535 1.145.933 1.844 1.093c.7.16 1.547-.046 2.094-.593c.438-.438.86-1.055 1.406-1.75c.547-.696 1.168-1.45 1.781-2.063c-.07.07.235-.093.626-.093c.316 0 .578.03.78.062c.052.008.157.027.188.031c.871.324 1.79.446 2.688.5c.011 0 .02.032.031.032c.07.019.145.027.219.03a.879.879 0 0 0 .093.032H18c.063-.004.125-.016.188-.031c.039-.004.054-.028.093-.032h.032c3.011-.25 5.03-1.34 6.312-2.625c1.758-1.757 3.023-4.062 3.313-6.53c.289-2.47-.481-5.106-2.657-7.282c-1.902-1.902-4.156-2.734-6.343-2.719zM7 6c.563 0 1 .438 1 1c0 .563-.438 1-1 1c-.563 0-1-.438-1-1c0-.563.438-1 1-1zm11.938.906c1.687-.031 3.378.567 4.937 2.125c1.785 1.781 2.29 3.73 2.063 5.656c-.227 1.926-1.239 3.864-2.72 5.344c-.995.996-2.44 1.774-4.968 2l-7.375-7.375c.293-2.82.988-3.894 2.031-4.937c1.48-1.48 3.383-2.524 5.313-2.75c.242-.028.476-.059.718-.063zM11.343 18l3.562 3.531a6.287 6.287 0 0 0-1.094-.093c-.609.003-1.382.039-2.03.687a25.044 25.044 0 0 0-1.938 2.219c-.559.71-1.055 1.367-1.281 1.593c-.118.118-.06.098-.22.063s-.484-.234-.843-.594c-.352-.351-.527-.676-.563-.843c-.035-.168-.07-.122.032-.22c.21-.21.847-.718 1.562-1.28c.715-.563 1.531-1.22 2.25-1.938c.692-.691.7-1.492.688-2.125c-.008-.48-.082-.762-.125-1z"
          />
        </svg>
      </span>
    );
  if (key.includes("chess") || key.includes("šah") || key.includes("sah"))
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 20 20"
          role="img"
          aria-label="chess"
          className="block"
        >
          <title>Chess</title>
          <path
            fill="currentColor"
            d="M10 3a1 1 0 0 1 1-1h.5c.385 0 .737.145 1.002.384A1.494 1.494 0 0 1 13.505 2h.99c.385 0 .737.145 1.003.384A1.494 1.494 0 0 1 16.5 2h.5a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 1-1.95 2.44c.284 4.043 1.7 6.585 2.187 7.35c.16.252.263.553.263.877v.333A1.5 1.5 0 0 1 17 18h-5.476a2.44 2.44 0 0 0 .435-1H17a.5.5 0 0 0 .5-.5v-.333a.637.637 0 0 0-.107-.34c-.573-.9-2.155-3.774-2.369-8.304A.5.5 0 0 1 15.518 7A1.5 1.5 0 0 0 17 5.5V3h-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 1-1 .003V4.5l-.005-1.002a.5.5 0 0 0-.5-.498h-.99a.5.5 0 0 0-.5.498L13 4.502a.5.5 0 0 1-1-.003v-1a.5.5 0 0 0-.5-.5H11v2.5A1.5 1.5 0 0 0 12.482 7a.5.5 0 0 1 .494.523c-.158 3.34-1.06 5.779-1.752 7.191a2.817 2.817 0 0 0-.203-.188a4.192 4.192 0 0 1-.55-.558c.588-1.278 1.288-3.315 1.479-6.029A2.505 2.505 0 0 1 10 5.5V3ZM4.5 8a2 2 0 1 1 3.6 1.2a.5.5 0 0 0 .4.8H9a.5.5 0 0 1 0 1H7.893a.5.5 0 0 0-.496.56c.302 2.47 1.609 3.888 2.34 4.5c.175.146.263.33.263.489a.451.451 0 0 1-.451.451H3.45a.451.451 0 0 1-.45-.451c0-.16.088-.343.262-.489c.732-.612 2.04-2.03 2.341-4.5a.5.5 0 0 0-.496-.56H4a.5.5 0 0 1 0-1h.5a.5.5 0 0 0 .4-.8A1.989 1.989 0 0 1 4.5 8Zm2-3a3 3 0 0 0-2.817 4.034A1.5 1.5 0 0 0 4 12h.52c-.372 1.798-1.353 2.836-1.9 3.293c-.346.29-.62.736-.62 1.256C2 17.35 2.65 18 3.451 18H9.55c.8 0 1.45-.65 1.45-1.451c0-.52-.274-.966-.62-1.256c-.547-.457-1.528-1.495-1.9-3.293H9a1.5 1.5 0 0 0 .317-2.966A3 3 0 0 0 6.5 5Z"
          />
        </svg>
      </span>
    );
  if (key.includes("volleyball") || key.includes("odbojka"))
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          role="img"
          aria-label="volleyball"
          className="block"
        >
          <title>Volleyball</title>
          <path
            fill="currentColor"
            d="M2 20.5a1 1 0 0 0 1-1V18a.5.5 0 0 1 .5-.5h17a.5.5 0 0 1 .5.5v1a1 1 0 0 0 2 0V7.5a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1M18 9a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5Zm0 4.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V15a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5ZM13 9a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5Zm0 4.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V15a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5ZM8 9a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5Zm0 4.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V15a.5.5 0 0 1-.5.5h-2A.5.5 0 0 1 8 15ZM3 9a.5.5 0 0 1 .5-.5h2A.5.5 0 0 1 6 9v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5Zm0 4.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V15a.5.5 0 0 1-.5.5h-2A.5.5 0 0 1 3 15Zm20.72 9.16a11.9 11.9 0 0 0-7-2.16a10.8 10.8 0 0 0-4.35.86a1 1 0 0 1-.8 0a10.8 10.8 0 0 0-4.35-.86a11.9 11.9 0 0 0-7 2.16a.77.77 0 0 0-.22.84a.76.76 0 0 0 .71.5h22.5a.76.76 0 0 0 .71-.5a.77.77 0 0 0-.2-.84M16 2.75a2.75 2.75 0 1 0 5.5 0a2.75 2.75 0 1 0-5.5 0"
          />
        </svg>
      </span>
    );
  if (key.includes("stone") || key.includes("kamena"))
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 16 16"
          role="img"
          aria-label="stone"
          className="block"
        >
          <title>Stone</title>
          <path
            fill="currentColor"
            d="m11.438 3.004l-8 1a.5.5 0 0 0-.403.31l-1 2.5a.5.5 0 0 0 .008.39l2 4.5A.5.5 0 0 0 4.5 12h7a.5.5 0 0 0 .434-.252l2-3.5a.5.5 0 0 0 .023-.451l-2-4.5a.5.5 0 0 0-.52-.293"
          />
        </svg>
      </span>
    );
  if (key.includes("ski") || key.includes("daskanje"))
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 32 32"
          role="img"
          aria-label="ski"
          className="block"
        >
          <title>Ski</title>
          <path
            fill="currentColor"
            d="M14.5 4C12.57 4 11 5.57 11 7.5s1.57 3.5 3.5 3.5S18 9.43 18 7.5S16.43 4 14.5 4zm0 2c.827 0 1.5.673 1.5 1.5S15.327 9 14.5 9S13 8.327 13 7.5S13.673 6 14.5 6zm-.814 5.992a1.993 1.993 0 0 0-2.127 1.475L10.06 18.74a2.002 2.002 0 0 0 .753 2.096l3.206 2.342L14.78 27H9.955l1.03-1.412c.07-.131.131-.267.18-.4l.827-2.266l-1.685-1.219l-1.024 2.805a1.01 1.01 0 0 1-.058.129L7.502 27H3v2h21.486a4.688 4.688 0 0 0 4.455-3.21l.059-.173l-1.896-.633l-.057.172A2.698 2.698 0 0 1 24.487 27H21V16h-4.244l-.785-2.336a2.018 2.018 0 0 0-1.348-1.424l-.537-.166a1.982 1.982 0 0 0-.4-.082zm-.196 1.992l.567.254l.785 2.23a1.994 1.994 0 0 0 1.94 1.514H19V27h-2.18l-.834-4.182a1.998 1.998 0 0 0-.787-1.283l-3.207-2.28l1.498-5.27z"
          />
        </svg>
      </span>
    );
  if (key.includes("bocanje") || key.includes("boćanje"))
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          role="img"
          aria-label="bocanje"
          className="block"
        >
          <title>Bocanje</title>
          <path
            fill="currentColor"
            d="M13.922 6.44a1 1 0 0 0-1.703 1.05q.265.428.565.843a1 1 0 0 0 1.62-1.174q-.257-.353-.482-.719Zm-2.73 9.222a1 1 0 1 0-1.609 1.188c.17.23.327.466.476.709a1 1 0 1 0 1.705-1.047c-.178-.29-.368-.574-.572-.85Zm-3.707-3.429a1 1 0 0 0-1.045 1.705q.364.223.713.479A1 1 0 1 0 8.331 12.8q-.414-.302-.846-.567Zm10.06-2.167q-.364-.224-.715-.48a1 1 0 0 0-1.178 1.618q.415.302.847.567a1 1 0 1 0 1.047-1.705Zm1.447-5.065a9.9 9.9 0 1 0 0 14.001a9.913 9.913 0 0 0 0-14.001ZM17.72 17.729a8.03 8.03 0 0 1-4.516 2.273a.97.97 0 0 0-1.746.074a8.062 8.062 0 0 1-7.535-7.532a.975.975 0 0 0 .073-1.747a8.04 8.04 0 0 1 6.784-6.792a.997.997 0 0 0 .857.498a1.028 1.028 0 0 0 .23-.026a.982.982 0 0 0 .658-.546a8.054 8.054 0 0 1 7.538 7.538a.972.972 0 0 0-.074 1.741a8.046 8.046 0 0 1-2.27 4.519Z"
          />
        </svg>
      </span>
    );
  if (key.includes("dart") || key.includes("pikado"))
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 16 16"
          role="img"
          aria-label="dart"
          className="block"
        >
          <title>Dart</title>
          <path
            fill="currentColor"
            d="M13.293 0c.39 0 .707.317.707.707V2h1.293a.707.707 0 0 1 .5 1.207l-1.46 1.46A1.138 1.138 0 0 1 13.53 5h-1.47L8.53 8.53a.75.75 0 0 1-1.06-1.06L11 3.94V2.47c0-.301.12-.59.333-.804l1.46-1.46a.707.707 0 0 1 .5-.207ZM2.5 8a5.5 5.5 0 0 1 6.598-5.39a.75.75 0 0 0 .298-1.47A7 7 0 1 0 14.86 6.6a.75.75 0 0 0-1.47.299A5.5 5.5 0 1 1 2.5 8m5.364-2.496a.75.75 0 0 0-.08-1.498A4 4 0 1 0 11.988 8.3a.75.75 0 0 0-1.496-.111a2.5 2.5 0 1 1-2.63-2.686Z"
          />
        </svg>
      </span>
    );
  if (key.includes("rope") || key.includes("konopa"))
    return (
      <span className="inline-flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 512 512"
          role="img"
          aria-label="rope"
          className="block"
        >
          <title>Rope</title>
          <path
            fill="currentColor"
            d="M93.773 44.664L68.55 57.39l37.313 81.938l-12.09-94.664zm90.24 22.76L143.274 150.3l65.317-63.21l-24.58-19.666zM18.16 125.832l10.63 26.8l45.698 5.903l-56.328-32.703zm91.897 27.463c-3.665.025-7.122.8-10.256 2.295c-17.278 8.244-21.157 36.154-8.663 62.34c6.016 12.59 15.09 23.08 25.218 29.158c-10.305 83.743 29.287 137.784 91.366 163.535c-6.917 35.032-33.276 60.587-61.855 84.023l93.987 2.895l-9.897-9.165l-42.893-7.88c33.39-22.314 45.968-38.168 56.854-71.397c-5.27-10.354-18.877-24.948-25.432-35.895c19.945 2.308 49.183 5.725 53.745 10.135c3.78 9.84 21.27 31.79 27.754 59.832l6.336 20.523l49.205-46.476l-2.654-10.328l-39.57 26.59c.868-28.203-11.48-65.273-22.79-77.613c0 0-28.852-17.656-78.207-24.197c-23.798-16.76-36.016-42.392-45.87-60.483l51.965 3.803l80.844-9.424s2.82 2.165 6.457 4.72c5.99 9.605 16.65 16.048 28.718 16.048c15.646 0 28.932-10.82 32.732-25.334H486v-18H366.857c-4.145-13.994-17.165-24.31-32.44-24.31c-10.23 0-19.447 4.632-25.667 11.894c-1.853-.17-3.7-.344-5.45-.605l-9.023 13.026l-75.072 6.48l-63.6-9c7.833-12.96 7.088-33.54-1.896-52.412c-9.92-20.788-27.617-34.888-43.653-34.78zm224.36 83.394c8.846 0 15.825 6.976 15.825 15.822c0 8.845-6.98 15.822-15.824 15.822c-2.576 0-4.986-.606-7.12-1.664c2.146-10.544-.162-23.4-1.073-27.73a15.89 15.89 0 0 1 8.193-2.25zM384 384l-32 112h128V384h-96z"
          />
        </svg>
      </span>
    );
  // fallback
  return "🏅";
}

export default function Home() {
  const [sports, setSports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [trending, setTrending] = useState([]);
  const [tick, setTick] = useState(0);
  const [selectedSportMobile, setSelectedSportMobile] = useState(null);
  const location = useLocation();

  /* 🔹 Učitaj sportske kategorije */
  useEffect(() => {
    const loadSports = async () => {
      const { data, error } = await supabase.from("sports").select("id, name");
      if (!error) setSports(data || []);
    };
    loadSports();
  }, []);

  /* 🔹 Učitaj "trending" */
  useEffect(() => {
    const loadTrending = async () => {
      try {
        const items = await getRecentMatches(5);
        setTrending(items || []);
      } catch {
        setTrending([]);
      }
    };
    loadTrending();
  }, []);

  /* 🔹 Učitaj aktivne i zakazane utakmice */
  useEffect(() => {
    async function loadMatches() {
      try {
        const { data: ms } = await supabase
          .from("matches")
          .select(
            `
            id, score_a, score_b, start_time,
            is_running, status, duration_seconds, elapsed_seconds, last_started_at,
            team_a:team_a_id ( name ),
            team_b:team_b_id ( name ),
            sport:sport_id ( id, name )
          `
          )
          .order("start_time", { ascending: true });

        const norm = (ms || []).map((m) => ({
          ...m,
          team_a_name: m.team_a?.name || "-",
          team_b_name: m.team_b?.name || "-",
          sport_id: m.sport?.id,
          sport_name: m.sport?.name,
          is_running: !!m.is_running,
          status:
            m.status === "finished"
              ? "finished"
              : m.status === "live"
              ? "live"
              : "scheduled",
          duration_seconds: Number(m.duration_seconds ?? 600),
          elapsed_seconds: Number(m.elapsed_seconds ?? 0),
          last_started_at: m.last_started_at || null,
        }));
        setMatches(norm);
      } catch (e) {
        console.error("Error loading public matches:", e?.message || e);
        setMatches([]);
      }
    }

    loadMatches();

    const interval = setInterval(() => setTick((t) => t + 1), 1000);

    const ch = supabase
      .channel("public_matches_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => loadMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, []);

  const liveCount = matches.filter((m) => m.status === "live").length;
  const upcomingCount = matches.filter((m) => m.status === "scheduled").length;
  const finishedCount = matches.filter((m) => m.status === "finished").length;

  // Filtrirane utakmice za mobitel
  const filteredMatchesMobile = selectedSportMobile
    ? matches.filter((m) => m.sport_id === selectedSportMobile)
    : matches;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#040611] via-[#0D1117] to-[#020308]">
      {/* Top Navigation Bar */}
      <div className="bg-[#18181B]/80 backdrop-blur-xl border-b border-[#2C2C2F] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#bff47b] to-[#8fbe5b] flex items-center justify-center shadow-lg ">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-[#000]" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-black text-white tracking-tight">
                  Gerovski Sportski Dan
                </h1>
                <p className="text-xs text-[#A1A1AA]">2026.</p>
              </div>
            </div>
            {liveCount > 0 && (
              <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/20 border border-red-500/40 rounded-full animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs sm:text-sm font-bold text-red-400">
                  {liveCount} LIVE
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 gap-4 sm:gap-6">
        {/* LIJEVI SIDEBAR - DESKTOP */}
        <nav className="w-64 hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#bff47b]/20 rounded-2xl p-5 shadow-2xl">
              <h2 className="text-sm font-bold text-[#bff47b] mb-4 flex items-center uppercase tracking-wider">
                <BarChart2 size={16} className="mr-2" /> Sportovi
              </h2>
              <ul className="space-y-2">
                {sports.map((s) => {
                  const isActive = location.pathname.includes(`/sport/${s.id}`);
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/sport/${s.id}`}
                        className={`group flex items-center gap-3 p-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                          isActive
                            ? "bg-gradient-to-r from-[#bff47b] to-[#8fbe5b] text-[#0A0E27] shadow-lg shadow-[#bff47b]/30"
                            : "text-[#A1A1AA] hover:bg-[#2C2C2F] hover:text-white"
                        }`}
                      >
                        <span className="text-2xl">
                          {renderSportIcon(s.name)}
                        </span>
                        <span className="flex-1">{s.name}</span>
                        <ChevronRight
                          className={`w-4 h-4 transition-all ${
                            isActive
                              ? "opacity-100 translate-x-0"
                              : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                          }`}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#bff47b]/20 rounded-2xl p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-[#bff47b] mb-4 uppercase tracking-wider">
                Statistika
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A1A1AA]">
                    Ukupno utakmica
                  </span>
                  <span className="text-lg font-bold text-[#bff47b]">
                    {matches.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A1A1AA]">Live sada</span>
                  <span className="text-lg font-bold text-red-400">
                    {liveCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A1A1AA]">Nadolazi</span>
                  <span className="text-lg font-bold text-blue-400">
                    {upcomingCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A1A1AA]">Završeno</span>
                  <span className="text-lg font-bold text-green-400">
                    {finishedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* SREDIŠNJI SADRŽAJ */}
        <main className="flex-1 space-y-4 sm:space-y-6">
          {/* Hero Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#bff47b] via-[#a8db6a] to-[#8fbe5b] rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-20" />
            <div className="relative z-10 mb-3 sm:mb-5">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <Trophy size={24} className="sm:size-7 text-[#0A0E27]" />
                <span className="px-2 sm:px-3 py-1 bg-[#0A0E27]/20 backdrop-blur-sm rounded-full text-xs font-bold text-[#0A0E27]">
                  2026
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-2 text-[#0A0E27]">
                Dobrodošli na 12. Gerovski Sportski Dan!
              </h2>
              <p className="text-sm sm:text-base text-[#0A0E27]/80 mb-4 sm:mb-6 max-w-xl">
                Pratite rezultate uživo, statistike i sve najvažnije trenutke sa
                terena.
              </p>
            </div>
          </div>

          {/* MOBILE - Sport Categories Grid */}
          <div className="lg:hidden">
            <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4">
              <BarChart2 size={20} className="text-[#bff47b]" />
              Odaberi sport
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setSelectedSportMobile(null)}
                className={`p-4 rounded-xl transition-all duration-300 ${
                  selectedSportMobile === null
                    ? "bg-gradient-to-r from-[#bff47b] to-[#8fbe5b] shadow-lg shadow-[#bff47b]/30"
                    : "bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] hover:border-[#bff47b]/50"
                }`}
              >
                <div className="text-3xl mb-2">
                  <span className="inline-flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="1em"
                      height="1em"
                      viewBox="0 0 2048 2048"
                    >
                      <path
                        fill="currentColor"
                        d="M0 1408v-384h384v384H0zm128-256v128h128v-128H128zM0 896V512h384v384H0zm128-256v128h128V640H128zM0 384V0h384v384H0zm128-256v128h128V128H128zm512 640V640h1152v128H640zm896 384v128H640v-128h896zM640 128h1408v128H640V128zM0 1920v-384h384v384H0zm128-256v128h128v-128H128zm512 128v-128h1152v128H640z"
                      />
                    </svg>
                  </span>
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-sm font-bold truncate ${
                      selectedSportMobile === null
                        ? "text-white"
                        : "text-white"
                    }`}
                  >
                    Sve utakmice
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      selectedSportMobile === null
                        ? "text-[#A1A1AA]"
                        : "text-[#A1A1AA]"
                    }`}
                  >
                    {matches.length} utakmica
                  </div>
                </div>
              </button>

              {sports.map((s) => {
                const sportMatches = matches.filter((m) => m.sport_id === s.id);
                const isSelected = selectedSportMobile === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSportMobile(s.id)}
                    className={`p-4 rounded-xl transition-all duration-300 ${
                      selectedSportMobile === s.id
                        ? "bg-gradient-to-r from-[#bff47b] to-[#8fbe5b] shadow-lg shadow-[#bff47b]/30"
                        : "bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] hover:border-[#bff47b]/50"
                    }`}
                  >
                    <div className="text-3xl mb-2">
                      {renderSportIcon(s.name)}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold truncate ${
                          selectedSportMobile === s.id
                            ? "text-[#0A0E27]"
                            : "text-white"
                        }`}
                      >
                        {s.name}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          selectedSportMobile === s.id
                            ? "text-[#0A0E27]/70"
                            : "text-[#A1A1AA]"
                        }`}
                      >
                        {sportMatches.length} utakmica
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Clock size={20} className="sm:size-6 text-[#bff47b]" />
              {selectedSportMobile &&
              sports.find((s) => s.id === selectedSportMobile)
                ? `${
                    sports.find((s) => s.id === selectedSportMobile).name
                  } - Utakmice`
                : "Utakmice uživo"}
            </h3>
            <span className="text-xs sm:text-sm text-[#A1A1AA] flex items-center gap-2">
              <Calendar size={14} className="sm:size-4" />
              {new Date().toLocaleDateString("hr-HR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Matches List */}
          <div className="space-y-3">
            {filteredMatchesMobile.map((m) => {
              const isRunning = m.is_running;
              const isActive = m.status === "live";
              const isPaused = isActive && !isRunning;
              const isFinished = m.status === "finished";

              const displayScore =
                Number.isFinite(m.score_a) && Number.isFinite(m.score_b)
                  ? `${m.score_a} : ${m.score_b}`
                  : "VS";

              let remainingStr = null;
              let elapsedMinutes = null;
              if (isActive) {
                const rem = computeRemainingSeconds(m);
                const elapsed = Math.max(
                  0,
                  (Number(m.duration_seconds || 600) - rem) | 0
                );
                remainingStr = mmss(rem);
                elapsedMinutes = Math.floor(elapsed / 60);
              }

              const target = `/active-match/${m.id}`;

              return (
                <Link
                  key={m.id}
                  to={target}
                  className={`group relative overflow-hidden bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-xl sm:rounded-2xl transition-all duration-300 cursor-pointer border ${
                    isActive
                      ? "border-[#bff47b] shadow-[0_0_30px_rgba(191,244,123,0.3)] scale-[1.02]"
                      : "border-[#2C2C2F] hover:border-[#bff47b]/50 hover:scale-[1.01]"
                  }`}
                >
                  {/* Background pattern for active */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#bff47b]/5 to-transparent" />
                  )}

                  <div className="relative z-10 p-3 sm:p-5">
                    {/* DESKTOP LAYOUT */}
                    <div className="hidden sm:flex items-center gap-4">
                      {/* Status/Time Badge - FIKSNA ŠIRINA */}
                      <div className="w-[100px] flex-shrink-0">
                        {isRunning ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-red-400 text-sm font-bold whitespace-nowrap">
                              LIVE
                            </span>
                          </div>
                        ) : isPaused ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40">
                            <Pause size={14} className="text-amber-300" />
                            <span className="text-amber-300 text-sm font-bold whitespace-nowrap">
                              PAUZA
                            </span>
                          </div>
                        ) : isFinished ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/20 border border-green-500/40">
                            <CheckCircle2
                              size={14}
                              className="text-green-400"
                            />
                            <span className="text-green-400 text-sm font-bold whitespace-nowrap">
                              GOTOVO
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-500/40">
                            <Clock size={14} className="text-blue-400" />
                            <span className="text-blue-400 text-sm font-bold font-mono whitespace-nowrap">
                              {m.start_time
                                ? new Date(m.start_time).toLocaleTimeString(
                                    "hr-HR",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )
                                : "–"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Team A - FIKSNA ŠIRINA */}
                      <div className="w-[200px] flex-shrink-0 text-right">
                        <p className="text-white font-bold text-lg truncate">
                          {m.team_a_name}
                        </p>
                      </div>

                      {/* Score/VS - FIKSNA ŠIRINA */}
                      <div className="w-[120px] flex-shrink-0 text-center">
                        {isActive ? (
                          <div className="flex flex-col items-center justify-center">
                            <div className="text-4xl font-black text-[#bff47b] tracking-tight whitespace-nowrap">
                              {displayScore}
                            </div>
                            <div className="flex items-center justify-center gap-2 text-xs mt-1">
                              <Clock size={12} className="text-[#bff47b]" />
                              <span className="font-mono font-bold text-[#bff47b]">
                                {remainingStr}
                              </span>
                              <span className="text-[#A1A1AA]">
                                ({elapsedMinutes}')
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`text-3xl font-black tracking-tight whitespace-nowrap ${
                              isFinished ? "text-[#bff47b]" : "text-[#A1A1AA]"
                            }`}
                          >
                            {displayScore}
                          </div>
                        )}
                      </div>

                      {/* Team B - FIKSNA ŠIRINA */}
                      <div className="w-[200px] flex-shrink-0 text-left">
                        <p className="text-white font-bold text-lg truncate">
                          {m.team_b_name}
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="flex-1 flex justify-end">
                        <ChevronRight
                          className={`w-5 h-5 text-[#666] transition-all ${
                            isActive
                              ? "text-[#bff47b]"
                              : "group-hover:text-[#bff47b] group-hover:translate-x-1"
                          }`}
                        />
                      </div>
                    </div>

                    {/* MOBILE LAYOUT */}
                    <div className="sm:hidden space-y-3">
                      {/* Status Badge and Sport Icon */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Sport Icon */}
                          <span className="text-xl">
                            {renderSportIcon(m.sport_name)}
                          </span>

                          {isRunning ? (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 animate-pulse">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <span className="text-red-400 text-xs font-bold">
                                LIVE
                              </span>
                            </div>
                          ) : isPaused ? (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40">
                              <Pause size={12} className="text-amber-300" />
                              <span className="text-amber-300 text-xs font-bold">
                                PAUZA
                              </span>
                            </div>
                          ) : isFinished ? (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40">
                              <CheckCircle2
                                size={12}
                                className="text-green-400"
                              />
                              <span className="text-green-400 text-xs font-bold">
                                GOTOVO
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40">
                              <Clock size={12} className="text-blue-400" />
                              <span className="text-blue-400 text-xs font-bold font-mono">
                                {m.start_time
                                  ? new Date(m.start_time).toLocaleTimeString(
                                      "hr-HR",
                                      { hour: "2-digit", minute: "2-digit" }
                                    )
                                  : "–"}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#666] ${
                            isActive ? "text-[#bff47b]" : ""
                          }`}
                        />
                      </div>

                      {/* Teams and Score */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">
                            {m.team_a_name}
                          </p>
                        </div>

                        <div className="text-center px-3">
                          {isActive ? (
                            <div className="flex flex-col items-center">
                              <div className="text-2xl font-black text-[#bff47b] whitespace-nowrap">
                                {displayScore}
                              </div>
                              <div className="flex items-center gap-1 text-xs mt-0.5">
                                <Clock size={10} className="text-[#bff47b]" />
                                <span className="font-mono font-bold text-[#bff47b]">
                                  {remainingStr}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`text-2xl font-black whitespace-nowrap ${
                                isFinished ? "text-[#bff47b]" : "text-[#A1A1AA]"
                              }`}
                            >
                              {displayScore}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate text-right">
                            {m.team_b_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {filteredMatchesMobile.length === 0 && (
              <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-xl sm:rounded-2xl border border-[#2C2C2F]">
                <Calendar
                  size={40}
                  className="sm:size-12 mx-auto mb-3 sm:mb-4 text-[#A1A1AA]"
                />
                <p className="text-[#A1A1AA] text-base sm:text-lg">
                  {selectedSportMobile
                    ? "Nema utakmica za odabrani sport."
                    : "Trenutno nema dostupnih utakmica."}
                </p>
              </div>
            )}
          </div>
        </main>

        {/* DESNI SIDEBAR */}
        <aside className="w-80 hidden xl:block">
          <div className="sticky top-24 space-y-4">
            {/* Trending */}
            <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#bff47b]/20 rounded-2xl p-5 shadow-2xl">
              <h2 className="text-sm font-bold text-[#bff47b] mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Flame size={16} /> Trending
              </h2>
              <div className="space-y-3">
                {trending.map((item, i) => (
                  <div
                    key={i}
                    className="p-4 bg-gradient-to-br from-[#2C2C2F] to-[#18181B] rounded-xl border border-[#2C2C2F] hover:border-[#bff47b] transition-all duration-300 cursor-pointer group hover:scale-105"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#bff47b] to-[#8fbe5b] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#0A0E27] font-bold text-sm">
                          #{i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-[#bff47b] transition-colors truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-[#bff47b] mt-1 font-medium">
                          {item.value}
                        </p>
                        <p className="text-xs text-[#666] mt-1">{item.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Promo Card */}
            <div className="bg-gradient-to-br from-[#bff47b] via-[#a8db6a] to-[#8fbe5b] rounded-2xl p-6 text-center shadow-2xl">
              <Trophy size={40} className="mx-auto mb-3 text-[#0A0E27]" />
              <h3 className="font-black text-lg text-[#0A0E27] mb-2">
                Postani Prvak!
              </h3>
              <p className="text-[#0A0E27]/80 text-sm mb-4">
                Pridruži se i osvoji nagrade
              </p>
              <button className="px-4 py-2 bg-[#0A0E27] text-[#bff47b] font-bold rounded-lg hover:scale-105 transition-transform text-sm">
                Saznaj više
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
