---
title: How a toaster knows when to stop
subtitle: Thermal expansion and the bimetal switch
audience: Secondary school physics (ages 13-16)
level: 2
language: en
---

:::goals
- Say what happens to a metal bar when it gets hotter, and why.
- Use $\Delta L = \alpha L \Delta T$ to find how much a bar grows.
- Explain why two metals stuck together bend, and how that can switch a toaster off.
:::

## Metals grow when they warm up

:::bigidea
Heat makes the particles in a metal jiggle more, so they push each other slightly further apart and the whole bar gets a little longer.
:::

:::simple
Picture a line of people holding hands. If everyone starts dancing, the line spreads out a bit. The particles in a metal do the same when it warms up: they wiggle harder and need more room.

The change is tiny. A 1 metre steel ruler warmed by 10 °C grows by about a tenth of a millimetre.
:::

:::expert
The {{coefficient of linear expansion|How much a material's length changes per degree of temperature change, as a fraction of its length. Symbol α, unit 1/°C.}} $\alpha$ sets how much a solid lengthens per degree [@openstax-cp13]:

$$\Delta L = \alpha L \Delta T$$

Steel has $\alpha = 12 \times 10^{-6}$ per °C, and brass $19 \times 10^{-6}$ per °C, so brass grows about 1.6 times as much as steel for the same warming [@openstax-cp13].
:::

:::check
Q: A metal bar is heated. What happens to the gaps between its particles?
- [ ] They shrink, so the bar gets shorter
- [x] They grow a little, so the bar gets longer
- [ ] Nothing, metals never change size
A: Hotter particles vibrate more and push their neighbours slightly further away, so the bar lengthens.

Q: In your own words, why is the change in length so small that you never notice it on a ruler?
A: Because $\alpha$ is tiny, about 0.000012 per °C for steel, so even a 10 °C change only adds about 0.12 mm to a 1 m bar.
:::

:::keypoints
- Warmer metal means longer metal.
- $\Delta L = \alpha L \Delta T$: the growth depends on the material, the length and the temperature change.
:::

## Two metals glued together have to bend

:::bigidea
Bond a fast-growing metal to a slow-growing one and heat them: the fast one gets longer, but it can't slide past its partner, so the strip curls away from it.
:::

:::simple
Imagine two runners tied together side by side, one with longer steps. They can't stay in a straight line, so they curve round. A {{bimetal strip|Two strips of different metals bonded along their length. When heated, the one that expands more ends up on the outside of the curve.}} does exactly this when it warms up [@openstax-up1].
:::

:::expert
In a bimetal strip the higher-$\alpha$ layer ends up on the outside (convex) side of the bend. A bigger temperature change gives a sharper bend [@openstax-cp13], and the movement can close or open a switch at a set temperature, as in older thermostats [@openstax-up1].
:::

:::figure id=toaster-pop title="Inside a pop-up toaster" engine=colorfigure height=640
Press **Push the lever** and watch the bread go down. Switch on **See-through** and **Labels**, then watch the **bimetal strip** as the heating cards warm up. Before it pops, predict: which way will the strip bend, and what does it knock loose?
:::

:::example title="How much longer does a 5 cm brass strip get?"
The strip warms from 20 °C to 120 °C, so $\Delta T = 100$ °C.
---
Use $\Delta L = \alpha L \Delta T$ with $\alpha = 19 \times 10^{-6}$ per °C and $L = 5$ cm.
---
$\Delta L = 19 \times 10^{-6} \times 5 \times 100 = 0.0095$ cm, about 0.1 mm. Tiny, but bonded to steel this is enough to curl the strip.
:::

:::pitfall
The strip does not bend because one metal "melts" or goes soft. Both stay solid; one just gets longer than the other.
:::

:::check
Q: A strip is brass on the left and steel on the right. When heated, which side is on the outside of the curve?
- [x] Brass, because it expands more
- [ ] Steel, because it is stronger
- [ ] Neither, it stays straight
A: Brass has the bigger $\alpha$, so it gets longer and sits on the outside of the bend.

Q: Why does the toaster switch off by itself, without a clock?
A: As the strip heats up it bends further, until it pushes the latch that holds the bread carriage down. The carriage springs up and the heaters switch off.
:::

:::keypoints
- Different $\alpha$ + bonded together = bending when heated.
- The bend can push a switch or a latch at a set temperature.
:::

:::references
[@openstax-cp13] Urone, P. P., & Hinrichs, R. (2022). College Physics 2e, section 13.2 Thermal expansion of solids and liquids. OpenStax. https://openstax.org/books/college-physics-2e/pages/13-2-thermal-expansion-of-solids-and-liquids {grade=textbook}
[@openstax-up1] Ling, S. J., Sanny, J., & Moebs, W. (2016). University Physics Volume 2, section 1.3 Thermal expansion. OpenStax. https://openstax.org/books/university-physics-volume-2/pages/1-3-thermal-expansion {grade=textbook}
:::
