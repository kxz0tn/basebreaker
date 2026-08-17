# Basebreaker v2.0

Original 2D endless runner. Black-and-white industrial corridor. Jump. Roll. Fire.

Breach Helix Arc. Keep your flow. Cells are finite — pickups refill the rail. The Devil does not miss. Landscape on mobile.

Open `index.html` in a desktop or mobile browser. No install. No network.

## How to play

| Action | PC | Mobile |
| --- | --- | --- |
| Jump | W / ↑ | Swipe up |
| Roll | S / ↓ | Swipe down |
| Shoot | Space | Tap anywhere |

Roll under low lintels. Duck floating panes. A clip is a short stumble. Fire the rail at marked lock crates, full-height seals, and the Devil.

Seals cannot be jumped or rolled — they must be shot. The Devil takes 3–5 accurate hits. Fail the window and it delivers a guaranteed kill.

Lasers, pits, fields, and contact still kill.

Menus: arrows / WASD, Enter or Space to confirm, Esc to back. Pause: Esc / P. Mute: M.

## Combat

- Limited cells. Start with 6. Cap is 12.
- Every pickup refills cells (surge +3, aegis +4, overdrive +5, cell +3) on top of its original effect.
- Darts use real relative velocity: `v_world = v_runner + v_muzzle`. They always lead the corridor.
- Swept AABB collision. No tunneling.

## Original work

100% original and open source. Vanilla HTML, CSS, and JavaScript. Canvas 2D graphics. Runtime Web Audio. No third-party assets, fonts, samples, libraries, or CDNs.

## License

MIT. See [LICENSE](LICENSE).

Made by kxz0tn • Worked with the help of Grok
