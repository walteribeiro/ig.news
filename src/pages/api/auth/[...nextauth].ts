import { query as q } from "faunadb"
import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"
import { fauna } from "../../../services/fauna"

export default NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      try {
        const userActiveSubscription = await fauna.query(
          q.Get(
            q.Intersection(
              [
                q.Match(
                  q.Index('subscription_by_user_ref'),
                  q.Select(
                    'ref',
                    q.Get(
                      q.Match(
                        q.Index('user_by_email'),
                        q.Casefold(token.email)
                      )
                    )
                  )
                ),
                q.Match(
                  q.Index('subscription_by_status'),
                  'active'
                )
              ]
            )
          )
        )

        token.activeSubscription = userActiveSubscription
      } catch (error) {
        console.error(error)
        token.activeSubscription = null
      } finally {
        return token;
      }
    },
    async session({ session, token }) {
      session.activeSubscription = token.activeSubscription
      return session
    },
    async signIn({ user }) {
      const { email } = user

      try {
        await fauna.query(
          q.If(
            q.Not(
              q.Exists(
                q.Match(
                  q.Index('user_by_email'),
                  q.Casefold(email)
                )
              )
            ),
            q.Create(
              q.Collection('users'),
              { data: { email } }
            ),
            q.Get(
              q.Match(
                q.Index('user_by_email'),
                q.Casefold(email)
              )
            )
          )
        )

        return true
      } catch {
        return false
      }
    },
  }
})